import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();

// 🔥 CDK와 정확히 일치
const TABLE = process.env.ITEMS_TABLE_NAME as string;

export const handler = async () => {
  try {
    const res = await dynamo
      .get({
        TableName: TABLE,
        Key: { id: "featured" },
      })
      .promise();

    if (!res.Item) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      };
    }

    const item = res.Item;

    const video = {
      id: item.id,
      key: item.key,
      thumbnailKey: item.thumbnailKey,
      title: item.title,
      description: item.description,
      userId: item.userId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
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
