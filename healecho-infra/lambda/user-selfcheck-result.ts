// healecho-infra/lambda/user-selfcheck-result.ts
// 사용자가 자율신경 자가 체크 결과를 기록/조회하는 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.SELFCHECK_RESULTS_TABLE_NAME as string;

type SelfCheckAnswer = {
  symptomId: string;
  frequency: string;
};

type SelfCheckCategory = {
  id: string;
  title: string;
  icon: string;
  color: string;
  percent: number;
  selectedCount: number;
  totalCount: number;
};

type SelfCheckBody = {
  answers: SelfCheckAnswer[];
  categories: SelfCheckCategory[];
  affectedCategories: number;
  totalSelected: number;
  overallPercent: number;
  timestamp?: number;
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

    // POST /user/selfcheck-result — 자가 체크 결과 저장
    if (method === "POST") {
      const body: SelfCheckBody = JSON.parse(event.body || "{}");

      if (
        !body.answers ||
        !body.categories ||
        body.affectedCategories === undefined
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "answers, categories, affectedCategories는 필수입니다.",
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
            categories: body.categories,
            affectedCategories: body.affectedCategories,
            totalSelected: body.totalSelected,
            overallPercent: body.overallPercent,
            timestamp: body.timestamp || Date.now(),
            createdAt: now,
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          testDate,
          affectedCategories: body.affectedCategories,
        }),
      };
    }

    // GET /user/selfcheck-result — 자가 체크 결과 목록 조회 (최신순)
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
    console.error("user-selfcheck-result error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
