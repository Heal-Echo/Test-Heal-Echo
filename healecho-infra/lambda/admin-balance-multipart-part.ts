import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import AWS from "aws-sdk";

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET_NAME = process.env.UPLOAD_BUCKET!;
const URL_EXPIRATION_SECONDS = 60 * 10;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, uploadId, partNumber } = body;

    if (!key || !uploadId || !partNumber) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "key, uploadId, partNumber are required" }),
      };
    }

    const uploadUrl = await (s3 as any).getSignedUrlPromise("uploadPart", {
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: Number(partNumber),
      Expires: URL_EXPIRATION_SECONDS,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadUrl }),
    };
  } catch (err: any) {
    console.error("multipart part error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to sign upload part", error: err?.message }),
    };
  }
};
