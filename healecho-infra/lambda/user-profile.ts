// healecho-infra/lambda/user-profile.ts
// ==========================================
// 사용자 프로필 저장/조회 Lambda
// PUT  /user/profile — 프로필 저장 (온보딩 완료 시)
// GET  /user/profile — 프로필 조회
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USERS_TABLE_NAME as string;

type ProfileBody = {
  wellnessGoal: string;
  dietHabit: string | null;
  sleepHabit: string | null;
  experience: string;
  nickname: string;
  reportEmail: string;
  birthDate: string | null;
  gender: string | null;
  pushNotification: boolean;
  emailNotification: boolean;
  marketingConsent: boolean;
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // JWT에서 사용자 ID 추출
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub;
    const email = claims?.email || "";

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    // POST /user/record-login — 로그인 시각 기록
    if (method === "POST") {
      const now = new Date().toISOString();

      await dynamo
        .update({
          TableName: TABLE,
          Key: { userId },
          UpdateExpression: "SET lastLoginAt = :t, email = :e",
          ExpressionAttributeValues: { ":t": now, ":e": email },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, lastLoginAt: now }),
      };
    }

    // PUT /user/profile — 프로필 저장
    if (method === "PUT") {
      const body: ProfileBody = JSON.parse(event.body || "{}");
      const now = new Date().toISOString();

      // UsersTable에 프로필 데이터 저장 (upsert)
      const item: Record<string, any> = {
        userId,
        email: body.reportEmail || email,
        wellnessGoal: body.wellnessGoal || null,
        dietHabit: body.dietHabit || null,
        sleepHabit: body.sleepHabit || null,
        experience: body.experience || null,
        nickname: body.nickname || null,
        birthDate: body.birthDate || null,
        gender: body.gender || null,
        pushNotification: body.pushNotification ?? true,
        emailNotification: body.emailNotification ?? true,
        marketingConsent: body.marketingConsent ?? false,
        profileSetupDone: true,
        profileUpdatedAt: now,
      };

      // 기존 항목이 있으면 createdAt 유지, 없으면 새로 생성
      const existing = await dynamo
        .get({ TableName: TABLE, Key: { userId } })
        .promise();

      if (existing.Item) {
        // 기존 필드 병합 (기존 데이터 보존 + 프로필 필드 업데이트)
        item.createdAt = existing.Item.createdAt || now;
        item.subscriptionType = existing.Item.subscriptionType || "browser";
        // 기존 UsersTable의 다른 필드도 보존
        const merged = { ...existing.Item, ...item };
        await dynamo.put({ TableName: TABLE, Item: merged }).promise();
      } else {
        item.createdAt = now;
        item.subscriptionType = "browser";
        await dynamo.put({ TableName: TABLE, Item: item }).promise();
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, profileSetupDone: true }),
      };
    }

    // GET /user/profile — 프로필 조회
    if (method === "GET") {
      const result = await dynamo
        .get({ TableName: TABLE, Key: { userId } })
        .promise();

      if (!result.Item) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            profileSetupDone: false,
            profile: null,
          }),
        };
      }

      const profile = {
        wellnessGoal: result.Item.wellnessGoal || null,
        dietHabit: result.Item.dietHabit || null,
        sleepHabit: result.Item.sleepHabit || null,
        experience: result.Item.experience || null,
        nickname: result.Item.nickname || null,
        reportEmail: result.Item.email || null,
        birthDate: result.Item.birthDate || null,
        gender: result.Item.gender || null,
        pushNotification: result.Item.pushNotification ?? true,
        emailNotification: result.Item.emailNotification ?? true,
        marketingConsent: result.Item.marketingConsent ?? false,
        profileSetupDone: result.Item.profileSetupDone ?? false,
        profileUpdatedAt: result.Item.profileUpdatedAt || null,
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          profileSetupDone: profile.profileSetupDone,
          profile,
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request method" }),
    };
  } catch (err) {
    console.error("user-profile error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
