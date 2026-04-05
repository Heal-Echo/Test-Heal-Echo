/**
 * ================================
 *  기본 API 엔드포인트 설정
 * ================================
 */
export const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export const CLOUDFRONT_URL = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN ?? "";

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
  if (!key) return ""; // ❗ default 이미지 제거
  return `${CLOUDFRONT_URL.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/**
 * ================================
 *  Server-only: Intro Video Upstream
 *  (서버 컴포넌트에서만 사용 — 클라이언트에 노출되지 않음)
 * ================================
 */
export const PUBLIC_INTRO_VIDEOS_URL = process.env.PUBLIC_INTRO_VIDEOS_URL ?? "";

/**
 * ================================
 *  Featured Video
 * ================================
 */
export const FEATURED_VIDEO_ID = process.env.NEXT_PUBLIC_FEATURED_VIDEO_ID ?? "featured";

/**
 * ================================
 *  OAuth — Google
 * ================================
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ??
  "http://localhost:3000/api/public/auth/google/callback";

/**
 * ================================
 *  OAuth — Apple
 * ================================
 */
export const APPLE_SERVICE_ID = process.env.NEXT_PUBLIC_APPLE_SERVICE_ID ?? "";
export const APPLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ??
  "https://localhost:3000/api/public/auth/apple/callback";

/**
 * ================================
 *  OAuth — Kakao
 * ================================
 */
export const KAKAO_REST_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ?? "";
export const KAKAO_REDIRECT_URI =
  process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ??
  "http://localhost:3000/api/public/auth/kakao/callback";

/**
 * ================================
 *  OAuth — Naver
 * ================================
 */
export const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? "";
export const NAVER_REDIRECT_URI =
  process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI ??
  "http://localhost:3000/api/public/auth/naver/callback";

/**
 * ================================
 *  Cognito (일반 사용자)
 * ================================
 */
export const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "ap-northeast-2";
export const COGNITO_USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
export const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

/**
 * ================================
 *  Toss Payments
 * ================================
 */
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

/**
 * ================================
 *  Public Auth API Paths (Next.js internal routes)
 * ================================
 */
export const AUTH_API = {
  EXCHANGE: "/api/public/auth/exchange",
  STATE: "/api/public/auth/state",
  CHECK_LOGIN_METHOD: "/api/public/auth/check-login-method",
} as const;

export const USER_API = {
  PROFILE: "/api/user/profile",
  SUBSCRIPTION: "/api/user/subscription",
  PREFERENCES: "/api/user/preferences",
} as const;
