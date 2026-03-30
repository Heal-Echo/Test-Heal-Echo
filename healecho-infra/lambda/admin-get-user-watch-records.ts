import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.WATCH_RECORDS_TABLE_NAME as string;

export const handler = async (event: any) => {
  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "userId is required" }),
      };
    }

    const qs = event.queryStringParameters || {};
    const limit = Math.min(Number(qs.limit) || 50, 200);
    const lastKey = qs.lastKey ? JSON.parse(decodeURIComponent(qs.lastKey)) : undefined;

    // 기간 필터 (선택)
    const since = qs.since; // YYYY-MM-DD
    const until = qs.until; // YYYY-MM-DD

    let keyExpr = "userId = :uid";
    const exprValues: Record<string, any> = { ":uid": userId };

    if (since && until) {
      keyExpr += " AND watchDate BETWEEN :since AND :until";
      exprValues[":since"] = since;
      exprValues[":until"] = until;
    } else if (since) {
      keyExpr += " AND watchDate >= :since";
      exprValues[":since"] = since;
    } else if (until) {
      keyExpr += " AND watchDate <= :until";
      exprValues[":until"] = until;
    }

    const res = await dynamo
      .query({
        TableName: TABLE,
        KeyConditionExpression: keyExpr,
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false, // 최신순
        Limit: limit,
        ExclusiveStartKey: lastKey,
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: res.Items || [],
        lastKey: res.LastEvaluatedKey
          ? encodeURIComponent(JSON.stringify(res.LastEvaluatedKey))
          : null,
      }),
    };
  } catch (err) {
    console.error("admin-get-user-watch-records error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to get watch records" }),
    };
  }
};
