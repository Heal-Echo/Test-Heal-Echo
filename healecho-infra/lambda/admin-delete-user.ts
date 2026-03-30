// healecho-infra/lambda/admin-delete-user.ts
// ==========================================
// 관리자 회원 삭제 Lambda
// Cognito 즉시 삭제 + DynamoDB 8개 테이블 익명화
// ==========================================
// account-cleanup-scheduler.ts 와 동일한 익명화 전략 적용
// 관리자 판단에 의한 삭제이므로 유예 기간 없이 즉시 처리
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

  // ── 1) SubscriptionsTable ──
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

  // ── 2) PaymentsTable (5년 보관, PII 제거) ──
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
    });
    await deleteRecord(PAYMENTS_TABLE, {
      userId: pay.userId,
      paymentId: pay.paymentId,
    });
  }

  // ── 3) WatchRecordsTable ──
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

  // ── 4) UserHabitTrackingTable ──
  const habits = await queryByUserId(HABIT_TRACKING_TABLE, userId);
  for (const h of habits) {
    const anonymized = { ...h, userId: anonId, anonymizedAt: now };
    await putAnonymized(HABIT_TRACKING_TABLE, anonymized);
    await deleteRecord(HABIT_TRACKING_TABLE, {
      userId: h.userId,
      trackingKey: h.trackingKey,
    });
  }

  // ── 5) PSQIResultsTable ──
  const psqis = await queryByUserId(PSQI_TABLE, userId);
  for (const p of psqis) {
    const anonymized = { ...p, userId: anonId, anonymizedAt: now };
    await putAnonymized(PSQI_TABLE, anonymized);
    await deleteRecord(PSQI_TABLE, {
      userId: p.userId,
      testDate: p.testDate,
    });
  }

  // ── 6) SelfCheckResultsTable ──
  const selfchecks = await queryByUserId(SELFCHECK_TABLE, userId);
  for (const sc of selfchecks) {
    const anonymized = { ...sc, userId: anonId, anonymizedAt: now };
    await putAnonymized(SELFCHECK_TABLE, anonymized);
    await deleteRecord(SELFCHECK_TABLE, {
      userId: sc.userId,
      testDate: sc.testDate,
    });
  }

  // ── 7) UserSleepLogTable ──
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
}

export const handler = async (event: any) => {
  try {
    // pathParameters에서 userId 추출
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "userId is required" }),
      };
    }

    console.log("[AdminDeleteUser] Deleting user:", userId);

    const anonId = generateAnonId(userId);
    console.log("[AdminDeleteUser] Anonymizing:", userId, "→", anonId);

    // 1) DynamoDB 8개 테이블 익명화
    await anonymizeUser(userId, anonId);

    // 2) Cognito 사용자 완전 삭제
    try {
      await cognito
        .adminDeleteUser({
          UserPoolId: USER_POOL_ID,
          Username: userId,
        })
        .promise();
      console.log("[AdminDeleteUser] Cognito user deleted:", userId);
    } catch (cognitoErr: any) {
      if (cognitoErr.code !== "UserNotFoundException") {
        throw cognitoErr;
      }
      console.log("[AdminDeleteUser] Cognito user already deleted:", userId);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "User deleted and anonymized successfully",
        userId,
        anonId,
      }),
    };
  } catch (err) {
    console.error("[AdminDeleteUser] error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to delete user" }),
    };
  }
};
