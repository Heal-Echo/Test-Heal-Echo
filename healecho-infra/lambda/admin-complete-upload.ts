// healecho-infra/lambda/admin-complete-upload.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import AWS from "aws-sdk";

const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME!;

/**  
 * Cognito 인증된 관리자 userId 추출
 */
function getUserId(event: APIGatewayProxyEventV2): string {
  try {
    const ctx: any = event.requestContext;
    const claims =
      ctx?.authorizer?.jwt?.claims ||
      ctx?.authorizer?.claims ||
      undefined;
    return claims?.sub ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log("AdminCompleteUpload event:", JSON.stringify(event));

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // 🔵 1. /videos/{videoId}/complete 에서 videoId 받기
    const videoId = event.pathParameters?.videoId;
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "videoId is required" }),
      };
    }

    // 🔵 2. body 파싱
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, thumbnailKey, title, description } = body;

    if (!key || !title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "key and title are required",
        }),
      };
    }

    // 🔵 3. Cognito 사용자 정보 (선택적으로 저장)
    const userId = getUserId(event);

    const now = new Date().toISOString();

    // 🔵 4. 최종 저장될 Video item 구조
    const item = {
      id: videoId,                          // ex: "introduction"
      userId,                               // 업로드한 관리자
      title,
      description: description ?? "",
      key,                                  // ex: videos/featured/introduction.mp4
      thumbnailKey: thumbnailKey ?? null,   // ⭐ 추가됨
      createdAt: now,
      updatedAt: now,
    };

    // 🔵 5. DynamoDB 저장
    await ddb
      .put({
        TableName: TABLE_NAME,
        Item: item,
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(item),
    };
  } catch (error: any) {
    console.error("Complete upload error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to complete upload",
        error: error?.message || "Unknown error",
      }),
    };
  }
};
