// healecho-infra/lambda/admin-balance-update-video.ts
import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME as string;

type Body = {
  title?: string;
  description?: string;
  isPublished?: boolean;
  thumbnailKey?: string;
};

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

    const body: Body = JSON.parse(event.body || "{}");

    const expr: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    if (body.title !== undefined) {
      expr.push("#t = :t");
      names["#t"] = "title";
      values[":t"] = body.title;
    }
    if (body.description !== undefined) {
      expr.push("#d = :d");
      names["#d"] = "description";
      values[":d"] = body.description;
    }
    if (body.isPublished !== undefined) {
      expr.push("#p = :p");
      names["#p"] = "isPublished";
      values[":p"] = body.isPublished;
    }
    if (body.thumbnailKey !== undefined) {
      expr.push("#th = :th");
      names["#th"] = "thumbnailKey";
      values[":th"] = body.thumbnailKey;
    }

    // 항상 updatedAt 업데이트
    expr.push("#u = :u");
    names["#u"] = "updatedAt";
    values[":u"] = new Date().toISOString();

    if (expr.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "No fields to update" }),
      };
    }

    await dynamo
      .update({
        TableName: TABLE,
        Key: { program, weekNumber },
        UpdateExpression: "SET " + expr.join(", "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("admin-balance-update-video error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to update balance video",
      }),
    };
  }
};
