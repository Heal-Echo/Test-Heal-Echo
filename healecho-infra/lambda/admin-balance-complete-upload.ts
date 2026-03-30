// healecho-infra/lambda/admin-balance-complete-upload.ts
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME as string;

type Body = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  title: string;
  description?: string;
  thumbnailKey?: string;
};

export const handler = async (event: any) => {
  try {
    const body: Body = JSON.parse(event.body || "{}");

    if (
      !body.program ||
      !body.weekNumber ||
      !body.videoId ||
      !body.key ||
      !body.title
    ) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "program, weekNumber, videoId, key, title 는 필수입니다. (Balance complete)",
        }),
      };
    }

    const now = new Date().toISOString();

    await dynamo
      .put({
        TableName: TABLE,
        Item: {
          program: body.program,
          weekNumber: body.weekNumber,
          videoId: body.videoId,
          key: body.key,
          thumbnailKey: body.thumbnailKey ?? null,
          title: body.title,
          description: body.description ?? "",
          isPublished: true,
          createdAt: now,
          updatedAt: now,
        },
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("admin-balance-complete-upload error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to complete balance video upload",
      }),
    };
  }
};
