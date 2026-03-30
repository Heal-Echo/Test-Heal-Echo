import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import AWS from "aws-sdk";

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET_NAME = process.env.UPLOAD_BUCKET!;

type Part = { ETag: string; PartNumber: number };

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, uploadId, parts } = body as { key: string; uploadId: string; parts: Part[] };

    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "key, uploadId, parts[] are required" }),
      };
    }

    // S3는 PartNumber 오름차순 요구
    const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

    const result = await s3
      .completeMultipartUpload({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sorted.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
        },
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, key, location: result.Location }),
    };
  } catch (err: any) {
    console.error("multipart complete error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to complete multipart upload", error: err?.message }),
    };
  }
};
