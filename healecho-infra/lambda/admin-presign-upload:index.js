// 파일 경로: healecho-infra/lambda/admin-presign-upload/index.js
// 목적: presigned URL 생성 전 업로드 요청을 검증하고, 허용된 파일만 URL 발급

import {
    S3Client,
    PutObjectCommand,
  } from "@aws-sdk/client-s3";
  import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
  import { parseUrl } from "@smithy/url-parser";
  import { fromEnv } from "@aws-sdk/credential-providers";
  
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  
  export const handler = async (event) => {
    try {
      const body = event?.body ? JSON.parse(event.body) : {};
      const { filename, contentType, size } = body;
  
      // ----------------------------
      // 1️⃣ 파일명/확장자 검증
      // ----------------------------
      const allowedExts = [".mp4", ".mov", ".avi"];
      const ext = filename?.substring(filename.lastIndexOf(".")).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "허용되지 않은 파일 형식입니다. (mp4, mov, avi만 가능)",
          }),
        };
      }
  
// ✅ 파일 크기 제한 (예: 5GB)
const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
if (size > maxSize) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: "파일 크기가 5GB를 초과합니다. (4K 영상은 5GB 이하로 제한)",
    }),
  };
}

  
      // ----------------------------
      // 3️⃣ Content-Type 검사 (동영상 MIME)
      // ----------------------------
      if (!contentType?.startsWith("video/")) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Content-Type이 올바르지 않습니다. (video/* 형식만 허용)",
          }),
        };
      }
  
      // ----------------------------
      // 4️⃣ presigned URL 생성
      // ----------------------------
      const key = `uploads/${Date.now()}-${filename}`;
  
      const command = new PutObjectCommand({
        Bucket: process.env.VIDEO_BUCKET,
        Key: key,
        ContentType: contentType,
      });
  
      const presigner = new S3RequestPresigner({ ...s3.config });
      const signedUrl = await presigner.presign(command, { expiresIn: 3600 });
  
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadUrl: signedUrl, key }),
      };
    } catch (err) {
      console.error("Error in presign Lambda:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "서버 오류: presign 생성 실패" }),
      };
    }
  };
  