// healecho-infra/lambda/user-profile.ts
// ==========================================
// 사용자 프로필 저장/조회 Lambda
// PUT  /user/profile — 프로필 저장 (온보딩 완료 시)
// GET  /user/profile — 프로필 조회
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USERS_TABLE_NAME as string;

// PUT 요청 본문은 전체 프로필(온보딩) 또는 부분 업데이트(동의 정보 등)
// 어느 쪽이든 올 수 있으므로, 요청 본문에 포함된 필드만 DB에 반영
// → Record<string, any>로 받고, 포함 여부를 `key in body`로 판별

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  // CORS는 API Gateway corsPreflight에서 처리 → Lambda에서는 Content-Type만 설정
  const headers = {
    "Content-Type": "application/json",
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
      let body: Record<string, any>;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "Invalid JSON body" }),
        };
      }
      const now = new Date().toISOString();

      // ──────────────────────────────────────────────
      // 요청 본문에 실제로 포함된 필드만 업데이트 항목에 추가
      // → 누락된 필드는 기존 값을 유지 (null 덮어쓰기 방지)
      // 예: 이용약관 동의만 전송 시, 기존 wellnessGoal 등이 보존됨
      // ──────────────────────────────────────────────
      const PROFILE_FIELDS: Array<{
        key: string;
        fallback?: any;
      }> = [
        { key: "wellnessGoal" },
        { key: "dietHabit" },
        { key: "sleepHabit" },
        { key: "experience" },
        { key: "nickname" },
        { key: "birthDate" },
        { key: "gender" },
        { key: "pushNotification" },
        { key: "emailNotification" },
        { key: "marketingConsent" },
        { key: "termsConsent" },
        { key: "termsConsentAt" },
        { key: "marketingConsentAt" },
      ];

      const item: Record<string, any> = {
        userId,
        profileUpdatedAt: now,
      };

      // 이메일: body에 있으면 사용, 없으면 JWT 클레임에서 추출
      if (body.reportEmail) {
        item.email = body.reportEmail;
      } else if (email) {
        item.email = email;
      }

      // 프로필 필드: 요청 본문에 포함된 것만 item에 추가
      for (const field of PROFILE_FIELDS) {
        if (field.key in body) {
          item[field.key] = body[field.key];
        }
      }

      // profileSetupDone: body에 명시적으로 true이거나,
      // 실제 프로필 데이터(wellnessGoal)가 포함된 경우에만 true 설정
      // → 이용약관 동의만 전송된 경우 profileSetupDone을 true로 설정하지 않음
      if (body.profileSetupDone === true || body.wellnessGoal) {
        item.profileSetupDone = true;
      }

      // 기존 항목이 있으면 기존 데이터 보존 + 요청된 필드만 업데이트
      const existing = await dynamo
        .get({ TableName: TABLE, Key: { userId } })
        .promise();

      if (existing.Item) {
        item.createdAt = existing.Item.createdAt || now;
        item.subscriptionType = existing.Item.subscriptionType || "browser";
        // 기존 데이터 위에 요청된 필드만 덮어쓰기 (나머지 보존)
        const merged = { ...existing.Item, ...item };
        await dynamo.put({ TableName: TABLE, Item: merged }).promise();
      } else {
        item.createdAt = now;
        item.subscriptionType = "browser";
        await dynamo.put({ TableName: TABLE, Item: item }).promise();
      }

      const isFullProfile = !!item.profileSetupDone;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, profileSetupDone: isFullProfile }),
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
