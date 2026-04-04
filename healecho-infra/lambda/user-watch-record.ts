// healecho-infra/lambda/user-watch-record.ts
// ==========================================
// 사용자 시청 기록(WatchRecord) 저장/조회 Lambda
// GET  /user/watch-records?programId=autobalance — 시청 기록 조회
// POST /user/watch-records — 시청 기록 저장
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.WATCH_RECORDS_TABLE_NAME as string;

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

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    // ─────────────────────────────────────────
    // GET /user/watch-records?programId=autobalance
    // → 특정 프로그램의 시청 기록 전체 조회
    // ─────────────────────────────────────────
    if (method === "GET") {
      const programId =
        event.queryStringParameters?.programId || "autobalance";

      // watchDate 정렬 키가 "{programId}#" 로 시작하는 것만 조회
      const res = await dynamo
        .query({
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND begins_with(watchDate, :prefix)",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":prefix": `${programId}#`,
          },
          ScanIndexForward: true, // 오래된 순
        })
        .promise();

      // 클라이언트에 반환할 때는 watchDate에서 프로그램 접두사를 제거하여
      // 기존 프론트엔드 타입(WatchRecord)과 호환되도록 변환
      const items = (res.Items || []).map((item) => ({
        userId: item.userId,
        programId: item.programId,
        weekNumber: item.weekNumber,
        watchDate: item.originalDate, // 원본 날짜 (YYYY-MM-DD)
        watchDurationSeconds: item.watchDurationSeconds,
        isCompleted: item.isCompleted,
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items }),
      };
    }

    // ─────────────────────────────────────────
    // POST /user/watch-records
    // → 시청 기록 저장 (같은 날+같은 주차면 덮어쓰기)
    // ─────────────────────────────────────────
    if (method === "POST") {
      let body: any;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "잘못된 요청 형식입니다." }),
        };
      }

      // 필수 필드 검증
      if (!body.programId || !body.watchDate || body.weekNumber == null) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "programId, weekNumber, watchDate는 필수입니다.",
          }),
        };
      }

      // 정렬 키: {programId}#{weekNumber}#{watchDate}
      // 예: autobalance#1#2026-03-24
      const sortKey = `${body.programId}#${body.weekNumber}#${body.watchDate}`;
      const now = new Date().toISOString();

      // 기존 레코드 확인 (병합 + createdAt 보존)
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, watchDate: sortKey },
        })
        .promise();

      const prev = existing.Item;

      // ── 병합 로직: 멀티 디바이스 충돌 방지 ──
      // 오래된 디바이스가 시청 기록을 더 짧은 값으로 덮어쓰는 것을 방지
      const prevDuration = prev?.watchDurationSeconds ?? 0;
      const newDuration = body.watchDurationSeconds || 0;
      const prevCompleted = prev?.isCompleted ?? false;
      const newCompleted = body.isCompleted || false;

      const item = {
        userId,
        watchDate: sortKey, // DynamoDB 정렬 키 (복합)
        originalDate: body.watchDate, // 원본 날짜 (YYYY-MM-DD)
        programId: body.programId,
        weekNumber: body.weekNumber,
        // watchDurationSeconds: 항상 큰 값 유지
        watchDurationSeconds: Math.max(prevDuration, newDuration),
        // isCompleted: 한번 완료되면 유지 (false로 되돌리지 않음)
        isCompleted: prevCompleted || newCompleted,
        updatedAt: now,
        createdAt: prev?.createdAt || now,
      };

      await dynamo
        .put({
          TableName: TABLE,
          Item: item,
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          watchDate: body.watchDate,
          weekNumber: body.weekNumber,
          programId: body.programId,
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request method" }),
    };
  } catch (err) {
    console.error("user-watch-record error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
