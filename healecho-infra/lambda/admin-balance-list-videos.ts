import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();

// 🔥 CDK와 정확히 일치
const TABLE = process.env.BALANCE_TABLE_NAME as string;

export const handler = async (event: any) => {
  try {
    const program = event.pathParameters?.program;

    if (!program) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "program path param is required" }),
      };
    }

    const res = await dynamo
      .query({
        TableName: TABLE,
        KeyConditionExpression: "#p = :p",
        ExpressionAttributeNames: {
          "#p": "program",
        },
        ExpressionAttributeValues: {
          ":p": program,
        },
      })
      .promise();

    const items = (res.Items || []).sort(
      (a: any, b: any) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    };
  } catch (err) {
    console.error("admin-balance-list-videos error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to list balance videos",
      }),
    };
  }
};
