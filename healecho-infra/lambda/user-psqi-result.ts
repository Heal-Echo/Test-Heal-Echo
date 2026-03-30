// healecho-infra/lambda/user-psqi-result.ts
// 사용자가 PSQI 수면 품질 검사 결과를 기록/조회하는 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.PSQI_RESULTS_TABLE_NAME as string;

type PSQIBody = {
  answers: Record<string, string | number>;
  total: number;
  components: Record<string, number>;
  efficiency: number;
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

    // POST /user/psqi-result — PSQI 결과 저장
    if (method === "POST") {
      const body: PSQIBody = JSON.parse(event.body || "{}");

      if (
        body.total === undefined ||
        !body.components ||
        !body.answers
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "answers, total, components는 필수입니다.",
          }),
        };
      }

      const now = new Date().toISOString();
      const testDate = now.split("T")[0]; // YYYY-MM-DD

      await dynamo
        .put({
          TableName: TABLE,
          Item: {
            userId,
            testDate,
            answers: body.answers,
            total: body.total,
            components: body.components,
            efficiency: body.efficiency,
            createdAt: now,
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, testDate, total: body.total }),
      };
    }

    // GET /user/psqi-result — PSQI 결과 목록 조회 (최신순)
    if (method === "GET") {
      const res = await dynamo
        .query({
          TableName: TABLE,
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: {
            ":uid": userId,
          },
          ScanIndexForward: false, // 최신순
          Limit: 10,
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
    console.error("user-psqi-result error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
