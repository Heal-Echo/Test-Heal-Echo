// healecho-infra/lambda/admin-sleep-habit.ts
// 관리자가 주차별 수면 습관을 CRUD하는 Lambda 함수
// DynamoDB 테이블: SleepHabitTable (PK: program, SK: weekNumber)

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.SLEEP_HABIT_TABLE_NAME as string;

type SleepHabitBody = {
  habits: string[];
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const program = event.pathParameters?.program;
  const weekNumberRaw = event.pathParameters?.weekNumber;

  const headers = { "Content-Type": "application/json" };

  try {
    // GET /admin/sleep-habit/{program} — 전체 주차 목록 조회
    if (method === "GET" && program && !weekNumberRaw) {
      const res = await dynamo
        .query({
          TableName: TABLE,
          KeyConditionExpression: "#p = :p",
          ExpressionAttributeNames: { "#p": "program" },
          ExpressionAttributeValues: { ":p": program },
        })
        .promise();

      const items = (res.Items || []).sort(
        (a: any, b: any) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items }),
      };
    }

    // GET /admin/sleep-habit/{program}/{weekNumber} — 특정 주차 조회
    if (method === "GET" && program && weekNumberRaw) {
      const weekNumber = Number(weekNumberRaw);

      const res = await dynamo
        .get({
          TableName: TABLE,
          Key: { program, weekNumber },
        })
        .promise();

      if (!res.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "Not found", item: null }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ item: res.Item }),
      };
    }

    // PUT /admin/sleep-habit/{program}/{weekNumber} — 저장/수정
    if (method === "PUT" && program && weekNumberRaw) {
      const body: SleepHabitBody = JSON.parse(event.body || "{}");
      const weekNumber = Number(weekNumberRaw);
      const now = new Date().toISOString();

      if (!Array.isArray(body.habits)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "habits 배열은 필수입니다." }),
        };
      }

      await dynamo
        .put({
          TableName: TABLE,
          Item: {
            program,
            weekNumber,
            habits: body.habits,
            updatedAt: now,
          },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    // DELETE /admin/sleep-habit/{program}/{weekNumber} — 삭제
    if (method === "DELETE" && program && weekNumberRaw) {
      const weekNumber = Number(weekNumberRaw);

      await dynamo
        .delete({
          TableName: TABLE,
          Key: { program, weekNumber },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request" }),
    };
  } catch (err) {
    console.error("admin-sleep-habit error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
