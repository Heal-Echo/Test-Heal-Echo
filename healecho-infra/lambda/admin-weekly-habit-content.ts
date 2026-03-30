// healecho-infra/lambda/admin-weekly-habit-content.ts
// 관리자가 주차별 위클리 해빗 콘텐츠를 CRUD하는 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.WEEKLY_HABIT_CONTENT_TABLE_NAME as string;

type HabitItem = {
  name: string;
  description: string;
};

type ContentBody = {
  program: string;
  weekNumber: number;
  videoKey: string;
  thumbnailKey?: string;
  habitTitle: string;
  habitDescription: string;
  habitItems: HabitItem[];
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const program = event.pathParameters?.program;
  const weekNumberRaw = event.pathParameters?.weekNumber;

  const headers = { "Content-Type": "application/json" };

  try {
    // GET /admin/weekly-habit/{program} — 전체 주차 목록 조회
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

    // GET /admin/weekly-habit/{program}/{weekNumber} — 특정 주차 조회
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
          body: JSON.stringify({ message: "Content not found" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ item: res.Item }),
      };
    }

    // POST /admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 등록
    if (method === "POST" && program && weekNumberRaw) {
      const body: ContentBody = JSON.parse(event.body || "{}");
      const weekNumber = Number(weekNumberRaw);

      if (!body.habitTitle) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "habitTitle은 필수입니다.",
          }),
        };
      }

      // habitItems가 없으면 빈 배열로 기본값 (수면 습관에서 별도 등록)
      if (!body.habitItems) {
        body.habitItems = [];
      }

      if (body.habitItems.length > 7) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "habitItems는 최대 7개까지 가능합니다.",
          }),
        };
      }

      const now = new Date().toISOString();

      await dynamo
        .put({
          TableName: TABLE,
          Item: {
            program,
            weekNumber,
            videoKey: body.videoKey || null,
            thumbnailKey: body.thumbnailKey || null,
            habitTitle: body.habitTitle,
            habitDescription: body.habitDescription || "",
            habitItems: body.habitItems,
            isPublished: true,
            createdAt: now,
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

    // PUT /admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 수정
    if (method === "PUT" && program && weekNumberRaw) {
      const body: Partial<ContentBody> = JSON.parse(event.body || "{}");
      const weekNumber = Number(weekNumberRaw);
      const now = new Date().toISOString();

      // 기존 항목 확인
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { program, weekNumber },
        })
        .promise();

      if (!existing.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "Content not found" }),
        };
      }

      if (body.habitItems && body.habitItems.length > 7) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: "habitItems는 최대 7개까지 가능합니다.",
          }),
        };
      }

      const updated = {
        ...existing.Item,
        ...(body.videoKey !== undefined && { videoKey: body.videoKey }),
        ...(body.thumbnailKey !== undefined && { thumbnailKey: body.thumbnailKey }),
        ...(body.habitTitle !== undefined && { habitTitle: body.habitTitle }),
        ...(body.habitDescription !== undefined && { habitDescription: body.habitDescription }),
        ...(body.habitItems !== undefined && { habitItems: body.habitItems }),
        updatedAt: now,
      };

      await dynamo
        .put({
          TableName: TABLE,
          Item: updated,
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    // DELETE /admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 삭제
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
    console.error("admin-weekly-habit-content error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
