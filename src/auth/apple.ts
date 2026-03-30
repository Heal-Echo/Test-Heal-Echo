// src/auth/apple.ts
// =======================================================
// 🍎 애플 로그인 인증 모듈 (Cognito 하이브리드 연동)
// =======================================================

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { AUTH_KEYS } from "./constants";

// =======================================================
// 애플 OAuth 설정
// =======================================================
const APPLE_SERVICE_ID =
  process.env.NEXT_PUBLIC_APPLE_SERVICE_ID || "";
const APPLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ||
  "https://localhost:3000/api/public/auth/apple/callback";

// localStorage keys (constants.ts에서 중앙 관리)
const KEY_APPLE_ID = AUTH_KEYS.APPLE_ID;
const KEY_APPLE_NICKNAME = AUTH_KEYS.APPLE_NICKNAME;
const KEY_LOGIN_METHOD = AUTH_KEYS.LOGIN_METHOD;

const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_USER_EMAIL = AUTH_KEYS.USER_EMAIL;

// SSR 방지
function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 애플 로그인 URL 생성
// =======================================================
export function getAppleLoginUrl(state: string): string {
  // state는 서버에서 생성·저장된 CSRF 방지용 값 (외부에서 전달받음)
  const params = new URLSearchParams({
    client_id: APPLE_SERVICE_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: "code",
    scope: "name email",
    state,
    response_mode: "form_post",
  });

  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

// =======================================================
// 2) Cognito 애플 로그인 정보 localStorage 저장 (클라이언트 전용)
//    Cognito에서 발급한 JWT 토큰을 저장
// =======================================================
export function saveCognitoAppleSession(idToken: string, accessToken: string) {
  if (!isBrowser()) return;

  storage.setRaw(KEY_ID_TOKEN, idToken);
  storage.setRaw(KEY_ACCESS_TOKEN, accessToken);
  storage.setRaw(KEY_LOGIN_METHOD, "apple");

  // Cognito JWT에서 사용자 정보 추출
  try {
    const payload = JSON.parse(
      atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    const nickname =
      payload.nickname ||
      payload["cognito:username"] ||
      payload.name ||
      "";
    const email = payload.email || "";
    const sub = payload.sub || "";

    storage.setRaw(KEY_APPLE_NICKNAME, nickname);
    storage.setRaw(KEY_APPLE_ID, sub);
    if (email) storage.setRaw(KEY_USER_EMAIL, email);
  } catch {
    // JWT 파싱 실패 시에도 토큰은 저장됨
  }
}

// =======================================================
// 3) 애플 로그인 여부 확인
// =======================================================
export function isAppleUser(): boolean {
  if (!isBrowser()) return false;
  return storage.getRaw(KEY_LOGIN_METHOD) === "apple";
}

// =======================================================
// 4) 애플 사용자 정보 반환
// =======================================================
export function getAppleUserInfo() {
  if (!isBrowser()) return null;

  const appleId = storage.getRaw(KEY_APPLE_ID);
  if (!appleId) return null;

  return {
    appleId,
    nickname: storage.getRaw(KEY_APPLE_NICKNAME),
    email: storage.getRaw(KEY_USER_EMAIL),
    loginMethod: storage.getRaw(KEY_LOGIN_METHOD),
  };
}

// =======================================================
// 5) 애플 로그아웃 (localStorage 정리)
// =======================================================
export function appleLogout() {
  if (!isBrowser()) return;

  storage.removeRaw(KEY_APPLE_ID);
  storage.removeRaw(KEY_APPLE_NICKNAME);
  storage.removeRaw(KEY_LOGIN_METHOD);
  storage.removeRaw(KEY_ID_TOKEN);
  storage.removeRaw(KEY_ACCESS_TOKEN);
  storage.removeRaw(KEY_USER_EMAIL);

  storage.clearSession();
}
