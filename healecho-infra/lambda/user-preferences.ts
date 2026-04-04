// healecho-infra/lambda/user-preferences.ts
// ==========================================
// 사용자 환경설정 저장/조회 Lambda
// GET  /user/preferences — 환경설정 조회
// PUT  /user/preferences — 환경설정 저장 (부분 업데이트)
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USER_PREFERENCES_TABLE_NAME as string;

// 허용되는 환경설정 키 목록 (화이트리스트)
const ALLOWED_KEYS = [
  "weekly_habit_selected_program",
  "weekly_habit_program_confirmed",
  "weekly_habit_change_used",
  "weekly_habit_tracker_started",
  "weekly_habit_start_date",
] as const;

type PreferencesBody = Partial<Record<string, string | boolean | null>>;

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

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    // GET /user/preferences — 환경설정 전체 조회
    if (method === "GET") {
      const result = await dynamo
        .get({ TableName: TABLE, Key: { userId } })
        .promise();

      if (!result.Item) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ preferences: {} }),
        };
      }

      // userId, createdAt, updatedAt 등 메타 필드 제외하고 환경설정만 반환
      const { userId: _uid, createdAt, updatedAt, ...preferences } = result.Item;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ preferences }),
      };
    }

    // PUT /user/preferences — 환경설정 부분 업데이트
    if (method === "PUT") {
      let body: PreferencesBody;
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

      // 화이트리스트에 없는 키 필터링
      const filtered: PreferencesBody = {};
      for (const key of Object.keys(body)) {
        if (ALLOWED_KEYS.includes(key as any)) {
          filtered[key] = body[key];
        }
      }

      if (Object.keys(filtered).length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "No valid preference keys provided" }),
        };
      }

      // 기존 항목 가져와서 병합 (부분 업데이트)
      const existing = await dynamo
        .get({ TableName: TABLE, Key: { userId } })
        .promise();

      const item: Record<string, any> = {
        ...(existing.Item || {}),
        userId,
        ...filtered,
        updatedAt: now,
      };

      // 새 항목이면 createdAt 설정
      if (!existing.Item) {
        item.createdAt = now;
      }

      await dynamo.put({ TableName: TABLE, Item: item }).promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, updated: Object.keys(filtered) }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request method" }),
    };
  } catch (err) {
    console.error("user-preferences error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
