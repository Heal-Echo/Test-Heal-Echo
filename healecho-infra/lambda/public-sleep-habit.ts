// healecho-infra/lambda/public-sleep-habit.ts
// 사용자가 해당 주차까지의 누적 수면 습관을 조회하는 Lambda 함수
// 누적 로직: 1주차부터 요청 주차까지 모든 습관을 합산
// carry-forward: 특정 주차에 습관이 없으면 이전 주차 습관을 유지

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.SLEEP_HABIT_TABLE_NAME as string;

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

    // 1주차부터 요청 주차까지 모든 데이터 조회
    const res = await dynamo
      .query({
        TableName: TABLE,
        KeyConditionExpression: "#p = :p AND weekNumber <= :w",
        ExpressionAttributeNames: { "#p": "program" },
        ExpressionAttributeValues: {
          ":p": program,
          ":w": weekNumber,
        },
      })
      .promise();

    const items = (res.Items || []).sort(
      (a: any, b: any) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    );

    // 누적 습관 계산 (carry-forward 포함)
    // 각 주차의 습관을 순서대로 누적. 빈 주차는 건너뜀(이전 주 습관 유지).
    const cumulative: string[] = [];
    for (const item of items) {
      const habits: string[] = item.habits ?? [];
      for (const h of habits) {
        if (!cumulative.includes(h)) {
          cumulative.push(h);
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        item: {
          program,
          weekNumber,
          habits: cumulative,
        },
      }),
    };
  } catch (err) {
    console.error("public-sleep-habit error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Failed to fetch sleep habits" }),
    };
  }
};
