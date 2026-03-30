// healecho-infra/lambda/user-habit-tracking.ts
// 사용자가 습관 체크를 기록/조회하는 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USER_HABIT_TRACKING_TABLE_NAME as string;

type TrackingBody = {
  weekNumber: number;
  date: string; // YYYY-MM-DD
  habitIndex: number;
  checked: boolean;
  program: string;
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const headers = { "Content-Type": "application/json" };

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

    // POST /user/habit-tracking — 습관 체크 기록
    if (method === "POST") {
      const body: TrackingBody = JSON.parse(event.body || "{}");

      if (
        !body.weekNumber ||
        !body.date ||
        body.habitIndex === undefined ||
        body.checked === undefined ||
        !body.program
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message:
              "program, weekNumber, date, habitIndex, checked는 필수입니다.",
          }),
        };
      }

      // trackingKey 형식: {program}#{weekNumber}#{date}
      const trackingKey = `${body.program}#${body.weekNumber}#${body.date}`;
      const now = new Date().toISOString();

      // 기존 기록 조회
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, trackingKey },
        })
        .promise();

      let checkedItems: Record<string, boolean> = {};

      if (existing.Item && existing.Item.checkedItems) {
        checkedItems = existing.Item.checkedItems;
      }

      // 해당 습관 인덱스의 체크 상태 업데이트
      checkedItems[String(body.habitIndex)] = body.checked;

      await dynamo
        .put({
          TableName: TABLE,
          Item: {
            userId,
            trackingKey,
            program: body.program,
            weekNumber: body.weekNumber,
            date: body.date,
            checkedItems,
            updatedAt: now,
            ...(existing.Item?.createdAt
              ? { createdAt: existing.Item.createdAt }
              : { createdAt: now }),
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, checkedItems }),
      };
    }

    // GET /user/habit-tracking/{weekNumber}?program=xxx — 주차별 체크 기록 조회
    if (method === "GET") {
      const weekNumberRaw = event.pathParameters?.weekNumber;
      const program =
        event.queryStringParameters?.program || "autobalance";

      if (!weekNumberRaw) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "weekNumber path param is required",
          }),
        };
      }

      const weekNumber = Number(weekNumberRaw);
      const trackingKeyPrefix = `${program}#${weekNumber}#`;

      const res = await dynamo
        .query({
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND begins_with(trackingKey, :prefix)",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":prefix": trackingKeyPrefix,
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items: res.Items || [] }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request" }),
    };
  } catch (err) {
    console.error("user-habit-tracking error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
