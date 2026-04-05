// src/auth/tokenManager.ts
// =======================================================
// 🔑 Cognito 토큰 자동 갱신 관리 모듈
// - JWT 만료 확인
// - Cognito SDK getSession()으로 자동 갱신
// - storage 추상화 레이어를 통해 갱신된 토큰 저장
// =======================================================

import { userPool } from "./user";

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { AUTH_KEYS } from "./constants";

// localStorage key (constants.ts에서 중앙 관리)
const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_LOGIN_METHOD = AUTH_KEYS.LOGIN_METHOD;

function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) JWT 만료 확인 (클라이언트 사이드)
// =======================================================

/**
 * JWT 토큰의 만료 여부를 확인합니다.
 * - exp 클레임 기준, 30초 안전 마진 적용
 * - 파싱 실패 시 만료된 것으로 간주
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;

    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    if (!decoded.exp) return true;

    // 현재 시간 (초 단위) + 30초 안전 마진
    const nowSec = Math.floor(Date.now() / 1000);
    return decoded.exp < nowSec + 30;
  } catch {
    return true;
  }
}

// =======================================================
// 2) 동기 버전: 토큰 유효성만 확인 (갱신 안 함)
// =======================================================

/**
 * 현재 저장된 ID 토큰이 유효한지 확인합니다 (동기).
 * - 갱신 없이 현재 상태만 체크
 */
export function hasValidToken(): boolean {
  if (!isBrowser()) return false;

  const token = storage.getRaw(KEY_ID_TOKEN);
  if (!token) return false;

  return !isTokenExpired(token);
}

// =======================================================
// 3) 비동기 버전: 유효한 토큰 보장 (만료 시 자동 갱신)
// =======================================================

// =======================================================
// 3) user_login_method 자동 복원
// =======================================================
// localStorage가 유실되어도 JWT의 custom:signup_method에서 복원
// 모바일 앱 전환, 인앱 브라우저 등에서 안전하게 동작

function restoreLoginMethodIfMissing(idToken: string): void {
  // 이미 login_method가 있으면 아무것도 하지 않음
  const existing = storage.getRaw(KEY_LOGIN_METHOD);
  if (existing) return;

  try {
    const payload = idToken.split(".")[1];
    if (!payload) return;

    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const decoded = JSON.parse(json);

    // Cognito custom attribute: custom:signup_method
    const signupMethod = decoded["custom:signup_method"];
    if (signupMethod) {
      storage.setRaw(KEY_LOGIN_METHOD, signupMethod);
      console.log(`[TokenManager] login_method 복원: ${signupMethod}`);
    }
  } catch {
    // JWT 파싱 실패 시 무시 (다음 기회에 재시도)
  }
}

/**
 * 유효한 인증 토큰을 반환합니다.
 * - 토큰이 유효하면 즉시 반환 (빠른 경로)
 * - 토큰이 만료됐으면 Cognito SDK로 자동 갱신
 * - 갱신 실패 시 null 반환 (재로그인 필요)
 */
export async function ensureValidToken(): Promise<{
  idToken: string;
  accessToken: string;
} | null> {
  if (!isBrowser()) return null;

  // 1. 현재 토큰 확인
  const currentIdToken = storage.getRaw(KEY_ID_TOKEN);
  const currentAccessToken = storage.getRaw(KEY_ACCESS_TOKEN);

  // 토큰이 없으면 비로그인 상태
  if (!currentIdToken) return null;

  // 2. 토큰이 아직 유효하면 즉시 반환
  if (!isTokenExpired(currentIdToken)) {
    restoreLoginMethodIfMissing(currentIdToken);
    return {
      idToken: currentIdToken,
      accessToken: currentAccessToken || "",
    };
  }

  // 3. 토큰이 만료됨 → Cognito SDK로 갱신
  try {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      console.warn("[TokenManager] No Cognito user found, need re-login");
      return null;
    }

    // getSession()은 만료된 토큰을 refresh token으로 자동 갱신합니다
    const session = await new Promise<import("amazon-cognito-identity-js").CognitoUserSession>(
      (resolve, reject) => {
        cognitoUser.getSession(
          (
            err: Error | null,
            session: import("amazon-cognito-identity-js").CognitoUserSession | null
          ) => {
            if (err || !session) {
              reject(err || new Error("Session is null"));
              return;
            }
            resolve(session);
          }
        );
      }
    );

    if (!session.isValid()) {
      console.warn("[TokenManager] Session invalid after refresh");
      return null;
    }

    // 4. 갱신된 토큰을 storage 레이어에 저장
    const newIdToken = session.getIdToken().getJwtToken();
    const newAccessToken = session.getAccessToken().getJwtToken();

    storage.setRaw(KEY_ID_TOKEN, newIdToken);
    storage.setRaw(KEY_ACCESS_TOKEN, newAccessToken);
    restoreLoginMethodIfMissing(newIdToken);

    console.log("[TokenManager] Token refreshed successfully");

    return {
      idToken: newIdToken,
      accessToken: newAccessToken,
    };
  } catch (err) {
    console.error("[TokenManager] Token refresh failed:", err);
    return null;
  }
}
