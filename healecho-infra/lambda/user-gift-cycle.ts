// healecho-infra/lambda/user-gift-cycle.ts
// ==========================================
// 사용자 선물 사이클(GiftCycle) 저장/조회 Lambda
// GET  /user/gift-cycles?programId=autobalance — 현재 사이클 조회
// POST /user/gift-cycles — 사이클 저장/업데이트
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.GIFT_CYCLES_TABLE_NAME as string;

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
    // GET /user/gift-cycles?programId=autobalance
    // → 특정 프로그램의 선물 사이클 조회
    // ─────────────────────────────────────────
    if (method === "GET") {
      const programId =
        event.queryStringParameters?.programId || "autobalance";

      // cycleKey가 "{programId}#" 로 시작하는 모든 사이클 조회
      const res = await dynamo
        .query({
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND begins_with(cycleKey, :prefix)",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":prefix": `${programId}#`,
          },
          ScanIndexForward: false, // 최신 사이클이 먼저
        })
        .promise();

      // 클라이언트에 반환: GiftCycle 타입에 맞게 변환
      const items = (res.Items || []).map((item) => ({
        userId: item.userId,
        programId: item.programId,
        cycleNumber: item.cycleNumber,
        qualifiedWeeks: item.qualifiedWeeks,
        giftUnlockedAt: item.giftUnlockedAt || null,
        giftExpiresAt: item.giftExpiresAt || null,
        giftVideoId: item.giftVideoId || null,
      }));

      // 가장 최신 사이클 1개를 current로, 전체를 history로 반환
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          current: items.length > 0 ? items[0] : null,
          history: items,
        }),
      };
    }

    // ─────────────────────────────────────────
    // POST /user/gift-cycles
    // → 선물 사이클 저장/업데이트
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
      if (!body.programId || body.cycleNumber == null) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "programId, cycleNumber는 필수입니다.",
          }),
        };
      }

      // 정렬 키: {programId}#{cycleNumber}
      // 예: autobalance#1
      const cycleKey = `${body.programId}#${body.cycleNumber}`;
      const now = new Date().toISOString();

      // 기존 레코드 확인 (createdAt 보존용)
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, cycleKey },
        })
        .promise();

      // ── 병합 로직: 멀티 디바이스 충돌 방지 ──
      // 오래된 디바이스가 최신 진행도를 덮어쓰는 것을 방지
      const prev = existing.Item;
      const prevQW = prev?.qualifiedWeeks ?? 0;
      const newQW = body.qualifiedWeeks ?? 0;

      const item: any = {
        userId,
        cycleKey, // DynamoDB 정렬 키 (복합)
        programId: body.programId,
        cycleNumber: body.cycleNumber,
        // qualifiedWeeks: 항상 큰 값 유지 (진행도는 절대 뒤로 가지 않음)
        qualifiedWeeks: Math.max(prevQW, newQW),
        // giftUnlockedAt/giftExpiresAt: 기존에 있으면 유지 (해금 상태 보존)
        giftUnlockedAt: body.giftUnlockedAt || prev?.giftUnlockedAt || null,
        giftExpiresAt: body.giftExpiresAt || prev?.giftExpiresAt || null,
        giftVideoId: body.giftVideoId || prev?.giftVideoId || null,
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
          programId: body.programId,
          cycleNumber: body.cycleNumber,
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request method" }),
    };
  } catch (err) {
    console.error("user-gift-cycle error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
