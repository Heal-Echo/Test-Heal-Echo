// healecho-infra/lambda/admin-presign-upload.ts

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import AWS from "aws-sdk";
import * as path from "path";

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET_NAME = process.env.UPLOAD_BUCKET!;
const URL_EXPIRATION_SECONDS = 60 * 5;

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
  console.log("AdminPresignUpload event:", JSON.stringify(event));

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    const {
      fileName,
      fileType = "application/octet-stream",
      folder,
      videoId,
    } = body;

    if (!fileName || !folder || !videoId) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "fileName, folder, videoId are required",
        }),
      };
    }

    const cleanFileName = path.basename(fileName);
    const userId = getUserId(event);

    /**
     * 🔥 커스텀 key 규칙
     * 프론트에서 전달한 folder를 정확히 사용하도록 보장
     * e.g. uploads/<userId>/<videoId>/<fileName>
     */
    const key = `${folder}/${cleanFileName}`;

    const uploadUrl = await (s3 as any).getSignedUrlPromise("putObject", {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: URL_EXPIRATION_SECONDS,
      ContentType: fileType,
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadUrl,
        key,
        videoId,
        contentType: fileType,
      }),
    };
  } catch (error: any) {
    console.error("Presign error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Failed to generate upload URL",
        error: error?.message || "Unknown error",
      }),
    };
  }
};
