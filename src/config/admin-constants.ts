/**
 * ================================
 *  Cognito 설정 (관리자)
 * ================================
 */
export const ADMIN_USER_POOL_ID = process.env.NEXT_PUBLIC_ADMIN_USER_POOL_ID ?? "";

export const ADMIN_CLIENT_ID = process.env.NEXT_PUBLIC_ADMIN_CLIENT_ID ?? "";

export const ADMIN_REGION = process.env.NEXT_PUBLIC_ADMIN_REGION ?? "ap-northeast-2";

/**
 * ================================
 * LocalStorage key prefix
 * ================================
 */
export const SESSION_STORAGE_KEY = "video-admin-session";

// Debug logging — only in development
if (process.env.NODE_ENV === "development") {
  console.log(
    "[HealEcho Admin Auth Config]",
    "ADMIN_POOL:",
    ADMIN_USER_POOL_ID,
    "ADMIN_CLIENT:",
    ADMIN_CLIENT_ID,
    "REGION:",
    ADMIN_REGION
  );
}
