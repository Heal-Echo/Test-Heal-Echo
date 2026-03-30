// healecho-infra/lambda/user-practice-record.ts
// 사용자 실천 기록(솔루션/해빗/이해의바다) 기록/조회 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.PRACTICE_RECORDS_TABLE_NAME as string;

type PracticeBody = {
  type: "solution" | "habit" | "understanding";
  date: string; // YYYY-MM-DD
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const headers = { "Content-Type": "application/json" };

  try {
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    // POST /user/practice-record — 실천 기록 저장
    if (method === "POST") {
      const body: PracticeBody = JSON.parse(event.body || "{}");

      if (!body.type || !body.date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "type, date는 필수입니다.",
          }),
        };
      }

      const validTypes = ["solution", "habit", "understanding"];
      if (!validTypes.includes(body.type)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "type은 solution, habit, understanding 중 하나여야 합니다.",
          }),
        };
      }

      // recordKey: {type}#{YYYY-MM-DD}
      const recordKey = `${body.type}#${body.date}`;
      const now = new Date().toISOString();

      // 중복 방지: 같은 날짜+타입이면 덮어쓰기 (idempotent)
      await dynamo
        .put({
          TableName: TABLE,
          Item: {
            userId,
            recordKey,
            type: body.type,
            date: body.date,
            createdAt: now,
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, type: body.type, date: body.date }),
      };
    }

    // GET /user/practice-record — 실천 기록 조회 (전체 또는 타입별)
    if (method === "GET") {
      const typeFilter = event.queryStringParameters?.type;

      let params: AWS.DynamoDB.DocumentClient.QueryInput;

      if (typeFilter) {
        // 특정 타입만 조회
        params = {
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND begins_with(recordKey, :prefix)",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":prefix": `${typeFilter}#`,
          },
        };
      } else {
        // 전체 조회
        params = {
          TableName: TABLE,
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: {
            ":uid": userId,
          },
        };
      }

      const res = await dynamo.query(params).promise();

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
    console.error("user-practice-record error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
