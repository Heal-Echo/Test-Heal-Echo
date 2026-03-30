// healecho-infra/lambda/public-weekly-habit-content.ts
// 사용자가 해당 주차의 습관 콘텐츠를 조회하는 Lambda 함수

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.WEEKLY_HABIT_CONTENT_TABLE_NAME as string;

export const handler = async (event: any) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const program = event.pathParameters?.program;
    const weekNumberRaw = event.pathParameters?.weekNumber;

    if (!program || !weekNumberRaw) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "program and weekNumber path params are required",
        }),
      };
    }

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

    // isPublished가 false인 경우 사용자에게 노출하지 않음
    if (!res.Item.isPublished) {
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
  } catch (err) {
    console.error("public-weekly-habit-content error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Failed to fetch weekly habit content" }),
    };
  }
};
