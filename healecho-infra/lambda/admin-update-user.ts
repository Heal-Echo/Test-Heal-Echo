import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USERS_TABLE_NAME as string;

// 관리자가 변경할 수 있는 필드 (화이트리스트)
const ALLOWED_FIELDS = [
  "subscriptionType",  // browser | browser_selected | free_trial | paid | free_stopped | paid_stopped
  "status",            // active | paused | cancelled
  "currentWeek",       // 프로그램 주차 수동 조정
  "startDate",         // 구독 시작일 수동 조정
  "adminMemo",         // 관리자 메모
];

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

    const body = JSON.parse(event.body || "{}");

    // 허용된 필드만 추출
    const updates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "No valid fields to update" }),
      };
    }

    // 수정 시간 자동 기록
    updates.updatedAt = new Date().toISOString();

    // UpdateExpression 조립
    const exprParts: string[] = [];
    const exprNames: Record<string, string> = {};
    const exprValues: Record<string, any> = {};

    for (const [key, val] of Object.entries(updates)) {
      const nameKey = `#${key}`;
      const valKey = `:${key}`;
      exprParts.push(`${nameKey} = ${valKey}`);
      exprNames[nameKey] = key;
      exprValues[valKey] = val;
    }

    const res = await dynamo
      .update({
        TableName: TABLE,
        Key: { userId },
        UpdateExpression: `SET ${exprParts.join(", ")}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: res.Attributes }),
    };
  } catch (err) {
    console.error("admin-update-user error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to update user" }),
    };
  }
};
