// healecho-infra/lambda/account-cleanup-scheduler.ts
// ==========================================
// 매일 실행: 30일 유예 기간 만료 회원 익명화 + Cognito 삭제
// EventBridge → 이 Lambda
// ==========================================
// 익명화 전략:
//   - PII(이름, 이메일, 전화, 생년월일 등) 삭제
//   - 분석용 데이터(행동, 구독, 시청, 습관 등) 보존
//   - userId를 "withdrawn_XXXXXXXX" 해시 ID로 대체
//   - PaymentsTable: 결제 기록 5년 보관 (법적 의무)
// ==========================================

import AWS from "aws-sdk";
import crypto from "crypto";

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamo = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID as string;
const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const WATCH_RECORDS_TABLE = process.env.WATCH_RECORDS_TABLE_NAME as string;
const HABIT_TRACKING_TABLE = process.env.USER_HABIT_TRACKING_TABLE_NAME as string;
const PSQI_TABLE = process.env.PSQI_RESULTS_TABLE_NAME as string;
const SELFCHECK_TABLE = process.env.SELFCHECK_RESULTS_TABLE_NAME as string;
const SLEEP_LOG_TABLE = process.env.USER_SLEEP_LOG_TABLE_NAME as string;

const GRACE_PERIOD_DAYS = 30;

/** userId → 익명 ID 생성 (결정적, 비가역) */
function generateAnonId(userId: string): string {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  return `withdrawn_${hash.slice(0, 8)}`;
}

/** 테이블에서 userId로 모든 레코드 조회 */
async function queryByUserId(tableName: string, userId: string): Promise<any[]> {
  const result = await dynamo
    .query({
      TableName: tableName,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
    .promise();
  return result.Items || [];
}

/** 레코드 삭제 (원본 userId 키) */
async function deleteRecord(tableName: string, key: Record<string, any>): Promise<void> {
  await dynamo.delete({ TableName: tableName, Key: key }).promise();
}

/** 익명화된 레코드 저장 (새 anonId 키) */
async function putAnonymized(tableName: string, item: Record<string, any>): Promise<void> {
  await dynamo.put({ TableName: tableName, Item: item }).promise();
}

/** 단일 사용자의 모든 테이블 익명화 처리 */
async function anonymizeUser(userId: string, anonId: string): Promise<void> {
  const now = new Date().toISOString();

  // ── 1) SubscriptionsTable: 구독 이력 보존 ──
  const subs = await queryByUserId(SUBSCRIPTIONS_TABLE, userId);
  for (const sub of subs) {
    await putAnonymized(SUBSCRIPTIONS_TABLE, {
      userId: anonId,
      programId: sub.programId,
      subscriptionType: sub.subscriptionType,
      startDate: sub.startDate,
      trialEndDate: sub.trialEndDate,
      currentWeek: sub.currentWeek,
      status: sub.status,
      hasPlayedVideo: sub.hasPlayedVideo,
      createdAt: sub.createdAt,
      updatedAt: now,
      anonymizedAt: now,
    });
    await deleteRecord(SUBSCRIPTIONS_TABLE, {
      userId: sub.userId,
      programId: sub.programId,
    });
  }

  // ── 2) PaymentsTable: 결제 기록 5년 보관 (PII 제거) ──
  const payments = await queryByUserId(PAYMENTS_TABLE, userId);
  for (const pay of payments) {
    await putAnonymized(PAYMENTS_TABLE, {
      userId: anonId,
      paymentId: pay.paymentId,
      planType: pay.planType,
      amount: pay.amount,
      status: pay.status,
      chargedAt: pay.chargedAt,
      nextChargeDate: pay.nextChargeDate,
      createdAt: pay.createdAt,
      updatedAt: now,
      anonymizedAt: now,
      // billingKey, cardLast4, customerKey, cardCompany 삭제됨
    });
    await deleteRecord(PAYMENTS_TABLE, {
      userId: pay.userId,
      paymentId: pay.paymentId,
    });
  }

  // ── 3) WatchRecordsTable: 시청 기록 보존 ──
  const watches = await queryByUserId(WATCH_RECORDS_TABLE, userId);
  for (const w of watches) {
    await putAnonymized(WATCH_RECORDS_TABLE, {
      userId: anonId,
      watchDate: w.watchDate,
      programId: w.programId,
      weekNumber: w.weekNumber,
      isCompleted: w.isCompleted,
      watchDuration: w.watchDuration,
      completedAt: w.completedAt,
      anonymizedAt: now,
    });
    await deleteRecord(WATCH_RECORDS_TABLE, {
      userId: w.userId,
      watchDate: w.watchDate,
    });
  }

  // ── 4) UserHabitTrackingTable: 습관 데이터 보존 ──
  const habits = await queryByUserId(HABIT_TRACKING_TABLE, userId);
  for (const h of habits) {
    const anonymized = { ...h, userId: anonId, anonymizedAt: now };
    await putAnonymized(HABIT_TRACKING_TABLE, anonymized);
    await deleteRecord(HABIT_TRACKING_TABLE, {
      userId: h.userId,
      trackingKey: h.trackingKey,
    });
  }

  // ── 5) PSQIResultsTable: PSQI 검사 결과 보존 ──
  const psqis = await queryByUserId(PSQI_TABLE, userId);
  for (const p of psqis) {
    const anonymized = { ...p, userId: anonId, anonymizedAt: now };
    await putAnonymized(PSQI_TABLE, anonymized);
    await deleteRecord(PSQI_TABLE, {
      userId: p.userId,
      testDate: p.testDate,
    });
  }

  // ── 6) SelfCheckResultsTable: 자가 체크 결과 보존 ──
  const selfchecks = await queryByUserId(SELFCHECK_TABLE, userId);
  for (const sc of selfchecks) {
    const anonymized = { ...sc, userId: anonId, anonymizedAt: now };
    await putAnonymized(SELFCHECK_TABLE, anonymized);
    await deleteRecord(SELFCHECK_TABLE, {
      userId: sc.userId,
      testDate: sc.testDate,
    });
  }

  // ── 7) UserSleepLogTable: 수면 기록 보존 ──
  const sleepLogs = await queryByUserId(SLEEP_LOG_TABLE, userId);
  for (const sl of sleepLogs) {
    const anonymized = { ...sl, userId: anonId, anonymizedAt: now };
    await putAnonymized(SLEEP_LOG_TABLE, anonymized);
    await deleteRecord(SLEEP_LOG_TABLE, {
      userId: sl.userId,
      logKey: sl.logKey,
    });
  }

  // ── 8) UsersTable: PII 제거, 분석용 필드 보존 ──
  await dynamo
    .update({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: `
        SET #s = :withdrawn,
            anonymizedAt = :now,
            updatedAt = :now
        REMOVE #name, email, phone, birthDate, nickname, adminMemo
      `,
      ExpressionAttributeNames: {
        "#s": "status",
        "#name": "name",
      },
      ExpressionAttributeValues: {
        ":withdrawn": "withdrawn",
        ":now": now,
      },
    })
    .promise();

  // ── 9) Cognito 사용자 완전 삭제 ──
  try {
    await cognito
      .adminDeleteUser({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
      .promise();
    console.log("[AccountCleanup] Cognito user deleted:", userId, "→", anonId);
  } catch (cognitoErr: any) {
    // 이미 삭제된 경우 무시
    if (cognitoErr.code !== "UserNotFoundException") {
      throw cognitoErr;
    }
    console.log("[AccountCleanup] Cognito user already deleted:", userId);
  }
}

export const handler = async () => {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffDate.toISOString();

  console.log("[AccountCleanup] Running for cutoff date:", cutoffIso);

  try {
    // 탈퇴 요청 후 30일 경과한 사용자 스캔
    const scanResult = await dynamo
      .scan({
        TableName: USERS_TABLE,
        FilterExpression: "#s = :withdrawing AND withdrawRequestedAt <= :cutoff",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":withdrawing": "withdrawing",
          ":cutoff": cutoffIso,
        },
      })
      .promise();

    const expiredUsers = scanResult.Items || [];
    console.log("[AccountCleanup] Found expired users:", expiredUsers.length);

    if (expiredUsers.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No expired users to process", date: now.toISOString() }),
      };
    }

    // 각 사용자 익명화 처리
    const results = await Promise.allSettled(
      expiredUsers.map(async (user) => {
        const userId = user.userId;
        const anonId = generateAnonId(userId);

        console.log("[AccountCleanup] Processing:", userId, "→", anonId);
        await anonymizeUser(userId, anonId);
        return { userId, anonId };
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // 실패한 항목 로깅
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          "[AccountCleanup] Failed for user:",
          expiredUsers[i]?.userId,
          "error:",
          r.reason
        );
      }
    });

    console.log("[AccountCleanup] Complete:", succeeded, "succeeded,", failed, "failed");

    return {
      statusCode: 200,
      body: JSON.stringify({
        date: now.toISOString(),
        totalExpired: expiredUsers.length,
        succeeded,
        failed,
      }),
    };
  } catch (err) {
    console.error("[AccountCleanup] error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Cleanup execution failed" }),
    };
  }
};
