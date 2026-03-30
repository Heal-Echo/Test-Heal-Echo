import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import AWS from "aws-sdk";
import * as path from "path";

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET_NAME = process.env.UPLOAD_BUCKET!;
const URL_EXPIRATION_SECONDS = 60 * 10;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "fileName, folder, videoId are required" }),
      };
    }

    const cleanFileName = path.basename(fileName);
    const key = `${folder}/${cleanFileName}`;

    // ✅ 멀티파트 시작
    const created = await s3
      .createMultipartUpload({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType,
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: created.UploadId,
        key,
        videoId,
        contentType: fileType,
        expiresInSeconds: URL_EXPIRATION_SECONDS,
      }),
    };
  } catch (err: any) {
    console.error("multipart initiate error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to initiate multipart upload", error: err?.message }),
    };
  }
};
