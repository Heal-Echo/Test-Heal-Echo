// healecho-infra/lambda/user-subscription.ts
// ==========================================
// 사용자 구독 상태 조회/저장 Lambda
// GET  /user/subscription?programId=autobalance — 구독 조회
// PUT  /user/subscription — 구독 저장/갱신
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;

/** 시작일로부터 현재 프로그램 주차 계산 (서버 사이드) */
function calculateCurrentWeek(startDate: string | null): number {
  if (!startDate) return 1;

  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/** 기본 구독 상태 (둘러보는 고객) */
function defaultSubscription(userId: string, programId: string) {
  return {
    userId,
    programId,
    subscriptionType: "browser",
    startDate: null,
    currentWeek: 1,
    status: "active",
    pausedAt: null,
    trialEndDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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

    // GET /user/subscription?programId=autobalance
    if (method === "GET") {
      const programId =
        event.queryStringParameters?.programId || "autobalance";

      const result = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, programId },
        })
        .promise();

      if (!result.Item) {
        // 구독 레코드 없음 → 기본값 반환 (DB에 저장하지 않음)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            subscription: defaultSubscription(userId, programId),
          }),
        };
      }

      // currentWeek를 서버에서 재계산
      const sub = result.Item;
      if (sub.startDate && sub.status === "active") {
        sub.currentWeek = calculateCurrentWeek(sub.startDate);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ subscription: sub }),
      };
    }

    // PUT /user/subscription — 구독 저장/갱신
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
      const programId = body.programId;

      if (!programId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "programId is required" }),
        };
      }

      const now = new Date().toISOString();

      // 부분 업데이트 요청 (hasPlayedVideo 등 단일 필드만 업데이트)
      if (body.hasPlayedVideo !== undefined && Object.keys(body).length <= 2) {
        // programId + hasPlayedVideo만 있는 경우 → 기존 레코드에 필드 추가
        const existing = await dynamo
          .get({
            TableName: TABLE,
            Key: { userId, programId },
          })
          .promise();

        if (existing.Item) {
          // 기존 레코드에 hasPlayedVideo 필드만 추가
          await dynamo
            .update({
              TableName: TABLE,
              Key: { userId, programId },
              UpdateExpression: "SET hasPlayedVideo = :hpv, updatedAt = :now",
              ExpressionAttributeValues: {
                ":hpv": true,
                ":now": now,
              },
            })
            .promise();

          const updated = { ...existing.Item, hasPlayedVideo: true, updatedAt: now };
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, subscription: updated }),
          };
        } else {
          // 레코드 없으면 기본값 + hasPlayedVideo 로 새로 생성
          const item = {
            ...defaultSubscription(userId, programId),
            hasPlayedVideo: true,
          };
          await dynamo.put({ TableName: TABLE, Item: item }).promise();
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, subscription: item }),
          };
        }
      }

      // 전체 구독 상태 업데이트 (기존 로직)
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, programId },
        })
        .promise();

      const item: Record<string, any> = {
        userId,
        programId,
        subscriptionType: body.subscriptionType || "browser",
        startDate: body.startDate ?? null,
        currentWeek: body.startDate
          ? calculateCurrentWeek(body.startDate)
          : 1,
        status: body.status || "active",
        pausedAt: body.pausedAt ?? null,
        trialEndDate: body.trialEndDate ?? null,
        updatedAt: now,
      };

      // 기존 레코드가 있으면 createdAt, hasPlayedVideo 보존
      if (existing.Item) {
        item.createdAt = existing.Item.createdAt;
        if (existing.Item.hasPlayedVideo) {
          item.hasPlayedVideo = existing.Item.hasPlayedVideo;
        }
      } else {
        item.createdAt = now;
      }

      await dynamo
        .put({
          TableName: TABLE,
          Item: item,
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, subscription: item }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request method" }),
    };
  } catch (err) {
    console.error("user-subscription error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
