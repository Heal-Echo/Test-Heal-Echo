// healecho-infra/lambda/public-get-videos.ts
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB();
const TABLE = process.env.VIDEO_TABLE_NAME;

export const handler = async () => {
  try {
    const result = await dynamo
      .getItem({
        TableName: TABLE!,
        Key: { id: { S: "featured" } },
      })
      .promise();

    if (!result.Item) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      };
    }

    const item = result.Item;

    const video = {
      id: item.id.S,
      key: item.key.S,
      thumbnailKey: item.thumbnailKey?.S ?? null,
      title: item.title.S,
      description: item.description?.S ?? "",
      userId: item.userId?.S ?? null,
      createdAt: item.createdAt.S,
      updatedAt: item.updatedAt?.S ?? item.createdAt.S,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [video] }),
    };
  } catch (err) {
    console.error("public-get-videos error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch public videos" }),
    };
  }
};
