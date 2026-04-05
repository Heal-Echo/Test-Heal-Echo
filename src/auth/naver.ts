// src/auth/naver.ts
// =======================================================
// 🟢 네이버 로그인 인증 모듈 (Cognito 하이브리드 연동)
// =======================================================

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { AUTH_KEYS } from "./constants";
import { NAVER_CLIENT_ID, NAVER_REDIRECT_URI } from "@/config/constants";
import { NAVER_CLIENT_SECRET } from "@/config/server-constants";

// =======================================================
// 네이버 OAuth 설정
// =======================================================
// Callback path (origin is determined dynamically at runtime)
const NAVER_CALLBACK_PATH = "/api/public/auth/naver/callback";
// Server-side fallback (used in exchangeNaverCode, etc.)
const NAVER_REDIRECT_URI_FALLBACK = NAVER_REDIRECT_URI;

/** Current origin-based Naver redirect URI (client) or env fallback (server) */
function getNaverRedirectUri(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${NAVER_CALLBACK_PATH}`;
  }
  return NAVER_REDIRECT_URI_FALLBACK;
}

// localStorage keys (constants.ts에서 중앙 관리)
const KEY_NAVER_ID = AUTH_KEYS.NAVER_ID;
const KEY_NAVER_NICKNAME = AUTH_KEYS.NAVER_NICKNAME;
const KEY_NAVER_PROFILE_IMAGE = AUTH_KEYS.NAVER_PROFILE_IMAGE;
const KEY_LOGIN_METHOD = AUTH_KEYS.LOGIN_METHOD;

const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_USER_EMAIL = AUTH_KEYS.USER_EMAIL;

// SSR 방지
function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 네이버 로그인 URL 생성
// =======================================================
export function getNaverLoginUrl(state: string): string {
  // state는 서버에서 생성·저장된 CSRF 방지용 값 (외부에서 전달받음)
  const params = new URLSearchParams({
    client_id: NAVER_CLIENT_ID,
    redirect_uri: getNaverRedirectUri(),
    response_type: "code",
    state,
    auth_type: "reprompt", // 매번 네이버 로그인 확인 화면 표시
  });

  return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
}

// =======================================================
// 2) 네이버 인증 코드 → 토큰 교환 (서버 사이드 전용)
// =======================================================
export async function exchangeNaverCode(
  code: string,
  state: string
): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}> {
  const clientId = NAVER_CLIENT_ID;
  const clientSecret = NAVER_CLIENT_SECRET;

  const res = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    }).toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error_description || "네이버 토큰 교환 실패");
  }

  const data = await res.json();

  // 네이버 API는 HTTP 200이어도 error 필드가 있을 수 있음
  if (data.error) {
    throw new Error(data.error_description || "네이버 토큰 교환 실패");
  }

  return data;
}

// =======================================================
// 3) 네이버 사용자 프로필 조회 (서버 사이드 전용)
// =======================================================
export interface NaverUserProfile {
  id: string;
  nickname: string;
  profileImage: string | null;
  email: string | null;
  name: string | null;
}

export async function getNaverUserProfile(accessToken: string): Promise<NaverUserProfile> {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error("네이버 사용자 정보 조회 실패");
  }

  const data = await res.json();

  if (data.resultcode !== "00") {
    throw new Error(data.message || "네이버 사용자 정보 조회 실패");
  }

  const response = data.response;

  return {
    id: response.id || "",
    nickname: response.nickname || response.name || "",
    profileImage: response.profile_image || null,
    email: response.email || null,
    name: response.name || null,
  };
}

// =======================================================
// 4) Cognito 네이버 로그인 정보 localStorage 저장 (클라이언트 전용)
//    Cognito에서 발급한 JWT 토큰을 저장
// =======================================================
export function saveCognitoNaverSession(idToken: string, accessToken: string) {
  if (!isBrowser()) return;

  storage.setRaw(KEY_ID_TOKEN, idToken);
  storage.setRaw(KEY_ACCESS_TOKEN, accessToken);
  storage.setRaw(KEY_LOGIN_METHOD, "naver");

  // Cognito JWT에서 사용자 정보 추출
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

    const nickname = payload.nickname || payload["cognito:username"] || payload.name || "";
    const email = payload.email || "";
    const sub = payload.sub || "";

    storage.setRaw(KEY_NAVER_NICKNAME, nickname);
    storage.setRaw(KEY_NAVER_ID, sub);
    if (email) storage.setRaw(KEY_USER_EMAIL, email);
  } catch {
    // JWT 파싱 실패 시에도 토큰은 저장됨
  }
}

// =======================================================
// 5) 네이버 로그인 여부 확인
// =======================================================
export function isNaverUser(): boolean {
  if (!isBrowser()) return false;
  return storage.getRaw(KEY_LOGIN_METHOD) === "naver";
}

// =======================================================
// 6) 네이버 사용자 정보 반환
// =======================================================
export function getNaverUserInfo() {
  if (!isBrowser()) return null;

  const naverId = storage.getRaw(KEY_NAVER_ID);
  if (!naverId) return null;

  return {
    naverId,
    nickname: storage.getRaw(KEY_NAVER_NICKNAME),
    profileImage: storage.getRaw(KEY_NAVER_PROFILE_IMAGE),
    email: storage.getRaw(KEY_USER_EMAIL),
    loginMethod: storage.getRaw(KEY_LOGIN_METHOD),
  };
}

// =======================================================
// 7) 네이버 로그아웃 (localStorage 정리)
// =======================================================
export function naverLogout() {
  if (!isBrowser()) return;

  storage.removeRaw(KEY_NAVER_ID);
  storage.removeRaw(KEY_NAVER_NICKNAME);
  storage.removeRaw(KEY_NAVER_PROFILE_IMAGE);
  storage.removeRaw(KEY_LOGIN_METHOD);
  storage.removeRaw(KEY_ID_TOKEN);
  storage.removeRaw(KEY_ACCESS_TOKEN);
  storage.removeRaw(KEY_USER_EMAIL);

  storage.clearSession();
}
