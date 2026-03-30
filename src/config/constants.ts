/**
 * ================================
 *  기본 API 엔드포인트 설정
 * ================================
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export const CLOUDFRONT_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN ?? "";

/**
 * ================================
 *  URL 생성 함수
 * ================================
 */
export function makeVideoUrl(key: string): string {
  if (!key) return "";
  return `${CLOUDFRONT_URL.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

export function makeThumbnailUrl(key?: string | null): string {
  if (!key) return "";   // ❗ default 이미지 제거
  return `${CLOUDFRONT_URL.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/**
 * ================================
 *  Cognito 설정 (관리자)
 * ================================
 */
export const ADMIN_USER_POOL_ID =
  process.env.NEXT_PUBLIC_ADMIN_USER_POOL_ID ?? "";

export const ADMIN_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADMIN_CLIENT_ID ?? "";

export const ADMIN_REGION =
  process.env.NEXT_PUBLIC_ADMIN_REGION ?? "ap-northeast-2";

/**
 * ================================
 * LocalStorage key prefix
 * ================================
 */
export const SESSION_STORAGE_KEY = "video-admin-session";

console.log(
  "[HealEcho Admin Auth Config]",
  "ADMIN_POOL:", ADMIN_USER_POOL_ID,
  "ADMIN_CLIENT:", ADMIN_CLIENT_ID,
  "REGION:", ADMIN_REGION
);
