// src/config/server-constants.ts
// =======================================================
// Server-only 환경변수 (API Route / Lambda에서만 사용)
// NEXT_PUBLIC_ 접두사가 없는 서버 전용 시크릿
// =======================================================

export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export const KAKAO_REST_API_KEY_SERVER = process.env.KAKAO_REST_API_KEY ?? "";

export const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET ?? "";

export const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "";

/**
 * Upstream API Gateway URL (user API route proxy 전용)
 * API Route proxy에서 Lambda로 요청을 전달할 때 사용
 */
export const UPSTREAM_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
