// healecho-infra/lambda/repair-profiles.ts
// ==========================================
// 일회성 프로필 복구 Lambda
// 손상된 프로필(profileSetupDone=true, wellnessGoal=null) 복구
// ──────────────────────────────────────────
// 복구 전략:
//   1순위: SubscriptionsTable — 구독한 programId로 복원
//   2순위: WatchRecordsTable — 시청한 programId로 복원
//   3순위: UserPreferencesTable — 선택한 프로그램으로 복원
//   4순위: 위 세 곳 모두 없으면 → profileSetupDone을 false로 설정
//          (다음 로그인 시 프로필 설정을 다시 진행)
//
// programId → wellnessGoal 매핑:
//   "autobalance"    → "auto-balance"
//   "womans-whisper"  → "womens-care"
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;
const WATCH_RECORDS_TABLE = process.env.WATCH_RECORDS_TABLE_NAME as string;
const PREFERENCES_TABLE = process.env.USER_PREFERENCES_TABLE_NAME as string;

// programId → wellnessGoal 매핑
const PROGRAM_TO_GOAL: Record<string, string> = {
  autobalance: "auto-balance",
  "womans-whisper": "womens-care",
};

/**
 * SubscriptionsTable에서 사용자의 프로그램 선택을 조회
 * (가장 최근 updatedAt 기준)
 */
async function findFromSubscriptions(userId: string): Promise<string | null> {
  try {
    const result = await dynamo
      .query({
        TableName: SUBSCRIPTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
      .promise();

    if (!result.Items || result.Items.length === 0) return null;

    // 가장 최근 구독 기록의 programId
    const sorted = result.Items.sort(
      (a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
    );

    const programId = sorted[0].programId;
    return PROGRAM_TO_GOAL[programId] || null;
  } catch (err) {
    console.warn(`[Repair] 구독 조회 실패 (userId: ${userId}):`, err);
    return null;
  }
}

/**
 * WatchRecordsTable에서 사용자의 시청 기록을 조회
 * (watchDate 형식: "{programId}#{weekNumber}#{date}")
 */
async function findFromWatchRecords(userId: string): Promise<string | null> {
  try {
    const result = await dynamo
      .query({
        TableName: WATCH_RECORDS_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
        Limit: 10,
        ScanIndexForward: false, // 최신순
      })
      .promise();

    if (!result.Items || result.Items.length === 0) return null;

    // watchDate에서 programId 추출 (예: "autobalance#1#2026-03-24")
    for (const item of result.Items) {
      const programId = item.programId || (item.watchDate || "").split("#")[0];
      if (programId && PROGRAM_TO_GOAL[programId]) {
        return PROGRAM_TO_GOAL[programId];
      }
    }
    return null;
  } catch (err) {
    console.warn(`[Repair] 시청 기록 조회 실패 (userId: ${userId}):`, err);
    return null;
  }
}

/**
 * UserPreferencesTable에서 사용자의 프로그램 선택을 조회
 */
async function findFromPreferences(userId: string): Promise<string | null> {
  try {
    const result = await dynamo
      .get({
        TableName: PREFERENCES_TABLE,
        Key: { userId },
      })
      .promise();

    if (!result.Item) return null;

    const programId = result.Item.weekly_habit_selected_program;
    if (programId && PROGRAM_TO_GOAL[programId]) {
      return PROGRAM_TO_GOAL[programId];
    }
    return null;
  } catch (err) {
    console.warn(`[Repair] 설정 조회 실패 (userId: ${userId}):`, err);
    return null;
  }
}

export const handler = async () => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    console.log("[Repair] 프로필 복구 시작");
    console.log("[Repair] Tables:", {
      USERS_TABLE,
      SUBSCRIPTIONS_TABLE,
      WATCH_RECORDS_TABLE,
      PREFERENCES_TABLE,
    });

    // ── 1단계: UsersTable 전체 스캔하여 손상된 레코드 찾기 ──
    // 조건: profileSetupDone = true AND wellnessGoal이 null/빈값
    const damaged: AWS.DynamoDB.DocumentClient.ItemList = [];
    let lastKey: AWS.DynamoDB.DocumentClient.Key | undefined;

    do {
      const scanResult = await dynamo
        .scan({
          TableName: USERS_TABLE,
          FilterExpression:
            "profileSetupDone = :done AND (attribute_not_exists(wellnessGoal) OR wellnessGoal = :null)",
          ExpressionAttributeValues: {
            ":done": true,
            ":null": null,
          },
          ExclusiveStartKey: lastKey,
        })
        .promise();

      if (scanResult.Items) {
        damaged.push(...scanResult.Items);
      }
      lastKey = scanResult.LastEvaluatedKey;
    } while (lastKey);

    console.log(`[Repair] 손상된 프로필 ${damaged.length}건 발견`);

    if (damaged.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "손상된 프로필이 없습니다.",
          damagedCount: 0,
          repairedCount: 0,
          resetCount: 0,
        }),
      };
    }

    // ── 2단계: 각 손상된 레코드에 대해 다른 테이블에서 wellnessGoal 복원 ──
    let repairedCount = 0;
    let resetCount = 0;
    const details: Array<{
      userId: string;
      email: string;
      action: string;
      wellnessGoal: string | null;
      source: string;
    }> = [];

    for (const user of damaged) {
      const userId = user.userId as string;
      const email = (user.email as string) || "unknown";

      // 1순위: 구독 기록
      let wellnessGoal = await findFromSubscriptions(userId);
      let source = "subscriptions";

      // 2순위: 시청 기록
      if (!wellnessGoal) {
        wellnessGoal = await findFromWatchRecords(userId);
        source = "watch_records";
      }

      // 3순위: 사용자 설정
      if (!wellnessGoal) {
        wellnessGoal = await findFromPreferences(userId);
        source = "preferences";
      }

      if (wellnessGoal) {
        // ✅ 복원 성공: wellnessGoal 업데이트
        await dynamo
          .update({
            TableName: USERS_TABLE,
            Key: { userId },
            UpdateExpression:
              "SET wellnessGoal = :goal, profileRepairedAt = :now",
            ExpressionAttributeValues: {
              ":goal": wellnessGoal,
              ":now": new Date().toISOString(),
            },
          })
          .promise();

        repairedCount++;
        details.push({
          userId,
          email,
          action: "REPAIRED",
          wellnessGoal,
          source,
        });
        console.log(
          `[Repair] ✅ 복원: ${email} → wellnessGoal="${wellnessGoal}" (출처: ${source})`
        );
      } else {
        // ❌ 복원 불가: profileSetupDone을 false로 리셋
        // → 다음 로그인 시 프로필 설정을 다시 진행
        await dynamo
          .update({
            TableName: USERS_TABLE,
            Key: { userId },
            UpdateExpression:
              "SET profileSetupDone = :false, profileRepairedAt = :now",
            ExpressionAttributeValues: {
              ":false": false,
              ":now": new Date().toISOString(),
            },
          })
          .promise();

        resetCount++;
        details.push({
          userId,
          email,
          action: "RESET",
          wellnessGoal: null,
          source: "none",
        });
        console.log(
          `[Repair] ⚠️ 복원 불가 → profileSetupDone 리셋: ${email}`
        );
      }
    }

    // ── 3단계: 결과 반환 ──
    const summary = {
      message: "프로필 복구 완료",
      damagedCount: damaged.length,
      repairedCount,
      resetCount,
      details,
    };

    console.log("[Repair] 완료:", JSON.stringify(summary, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(summary),
    };
  } catch (err) {
    console.error("[Repair] 에러:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Repair failed", error: String(err) }),
    };
  }
};
