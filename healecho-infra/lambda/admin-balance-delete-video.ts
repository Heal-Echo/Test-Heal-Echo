// healecho-infra/lambda/admin-balance-delete-video.ts
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME as string;

export const handler = async (event: any) => {
  try {
    const program = event.pathParameters?.program;
    const weekNumberRaw = event.pathParameters?.weekNumber;

    const weekNumber = weekNumberRaw ? Number(weekNumberRaw) : NaN;

    if (!program || !weekNumber || Number.isNaN(weekNumber)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "program, weekNumber path params are required",
        }),
      };
    }

    await dynamo
      .delete({
        TableName: TABLE,
        Key: { program, weekNumber },
      })
      .promise();

    return {
      statusCode: 204,
      headers: { "Content-Type": "application/json" },
      body: "",
    };
  } catch (err) {
    console.error("admin-balance-delete-video error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to delete balance video",
      }),
    };
  }
};
