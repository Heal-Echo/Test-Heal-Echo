"use strict";
// healecho-infra/lambda/admin-presign-upload.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const crypto_1 = __importDefault(require("crypto"));
// AWS SDK v2 S3 클라이언트 (Lambda 기본 내장)
const s3 = new aws_sdk_1.default.S3({ signatureVersion: 'v4' });
// CDK에서 넣어줄 환경변수 이름 (버킷 이름)
const BUCKET_NAME = process.env.UPLOAD_BUCKET;
// presigned URL 유효기간: 5분
const URL_EXPIRATION_SECONDS = 60 * 5;
const handler = async (event) => {
    console.log('AdminPresignUpload event:', JSON.stringify(event));
    try {
        // 1) Body 파싱 (예: { "fileType": "video/mp4" })
        const body = event.body ? JSON.parse(event.body) : {};
        const fileType = body.fileType || 'video/mp4';
        // 2) Cognito 토큰에서 userId(sub) 추출
        let userId = 'anonymous';
        try {
            const claims = event.requestContext?.authorizer?.claims ??
                event.requestContext?.authorizer?.jwt?.claims;
            if (claims && claims.sub) {
                userId = claims.sub;
            }
        }
        catch (e) {
            console.warn('Failed to read user id from claims:', e);
        }
        // 3) S3에 저장될 key 생성
        // 예: uploads/<userId>/<timestamp>-<uuid>
        const key = `uploads/${userId}/${Date.now()}-${crypto_1.default.randomUUID()}`;
        // 4) presigned URL 생성 파라미터
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            Expires: URL_EXPIRATION_SECONDS,
            ContentType: fileType,
        };
        // 5) PUT 업로드용 presigned URL 생성
        const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
        // 6) 클라이언트로 반환할 응답
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uploadUrl, key }),
        };
    }
    catch (error) {
        console.error('Error generating presigned URL:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Failed to generate upload URL',
                error: error?.message ?? 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
