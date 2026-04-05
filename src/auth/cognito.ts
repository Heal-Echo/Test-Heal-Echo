// src/auth/cognito.ts
// 목적: 관리자 인증은 서버(httpOnly 쿠키)에서만 처리한다.
// 따라서 localStorage 기반 토큰 관리, Cognito JS SDK 로그인은 사용하지 않는다.

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

export function clearTokens(): void {
  if (typeof window !== "undefined") {
    storage.removeRaw("access_token");
    storage.removeRaw("id_token");
  }
}

/**
 * 클라이언트에서 로그인 여부를 판단하지 않는다.
 * 로그인 체크는 middleware에서 처리함.
 */
export const isLoggedIn = (): boolean => {
  return false; // 항상 false로 반환 (middleware가 판단)
};

/**
 * Cognito SDK 기반 로그인 함수 제거됨.
 * 로그인은 반드시 /api/admin/login 라우트를 통해 수행한다.
 */
export const adminLogin = async (): Promise<never> => {
  throw new Error("adminLogin() is removed. Use /api/admin/login API to authenticate.");
};

/**
 * 로그아웃 역시 서버 API에서 처리해야 한다.
 */
export const logout = async (): Promise<void> => {
  clearTokens();

  await fetch("/api/admin/logout", {
    method: "POST",
  });
};
