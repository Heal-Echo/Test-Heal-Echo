// src/auth/google.ts
// =======================================================
// 🔵 구글 로그인 인증 모듈 (Cognito 하이브리드 연동)
// =======================================================

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { AUTH_KEYS } from "./constants";
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from "@/config/constants";
import { GOOGLE_CLIENT_SECRET } from "@/config/server-constants";

// localStorage keys (constants.ts에서 중앙 관리)
const KEY_GOOGLE_ID = AUTH_KEYS.GOOGLE_ID;
const KEY_GOOGLE_NICKNAME = AUTH_KEYS.GOOGLE_NICKNAME;
const KEY_GOOGLE_PROFILE_IMAGE = AUTH_KEYS.GOOGLE_PROFILE_IMAGE;
const KEY_LOGIN_METHOD = AUTH_KEYS.LOGIN_METHOD;

const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_USER_EMAIL = AUTH_KEYS.USER_EMAIL;

// SSR 방지
function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 구글 로그인 URL 생성
// =======================================================
export function getGoogleLoginUrl(state: string): string {
  // state는 서버에서 생성·저장된 CSRF 방지용 값 (외부에서 전달받음)
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// =======================================================
// 2) 구글 인증 코드 → 토큰 교환 (서버 사이드 전용)
// =======================================================
export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}> {
  const clientId = GOOGLE_CLIENT_ID;
  const clientSecret = GOOGLE_CLIENT_SECRET;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: GOOGLE_REDIRECT_URI,
      code,
    }).toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error_description || "구글 토큰 교환 실패");
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || "구글 토큰 교환 실패");
  }

  return data;
}

// =======================================================
// 3) 구글 사용자 프로필 조회 (서버 사이드 전용)
// =======================================================
export interface GoogleUserProfile {
  id: string;
  nickname: string;
  profileImage: string | null;
  email: string | null;
  name: string | null;
}

export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error("구글 사용자 정보 조회 실패");
  }

  const data = await res.json();

  return {
    id: data.id || "",
    nickname: data.name || "",
    profileImage: data.picture || null,
    email: data.email || null,
    name: data.name || null,
  };
}

// =======================================================
// 4) Cognito 구글 로그인 정보 localStorage 저장 (클라이언트 전용)
//    Cognito에서 발급한 JWT 토큰을 저장
// =======================================================
export function saveCognitoGoogleSession(idToken: string, accessToken: string) {
  if (!isBrowser()) return;

  storage.setRaw(KEY_ID_TOKEN, idToken);
  storage.setRaw(KEY_ACCESS_TOKEN, accessToken);
  storage.setRaw(KEY_LOGIN_METHOD, "google");

  // Cognito JWT에서 사용자 정보 추출
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

    const nickname = payload.nickname || payload["cognito:username"] || payload.name || "";
    const email = payload.email || "";
    const sub = payload.sub || "";

    storage.setRaw(KEY_GOOGLE_NICKNAME, nickname);
    storage.setRaw(KEY_GOOGLE_ID, sub);
    if (email) storage.setRaw(KEY_USER_EMAIL, email);
  } catch {
    // JWT 파싱 실패 시에도 토큰은 저장됨
  }
}

// =======================================================
// 5) 구글 로그인 여부 확인
// =======================================================
export function isGoogleUser(): boolean {
  if (!isBrowser()) return false;
  return storage.getRaw(KEY_LOGIN_METHOD) === "google";
}

// =======================================================
// 6) 구글 사용자 정보 반환
// =======================================================
export function getGoogleUserInfo() {
  if (!isBrowser()) return null;

  const googleId = storage.getRaw(KEY_GOOGLE_ID);
  if (!googleId) return null;

  return {
    googleId,
    nickname: storage.getRaw(KEY_GOOGLE_NICKNAME),
    profileImage: storage.getRaw(KEY_GOOGLE_PROFILE_IMAGE),
    email: storage.getRaw(KEY_USER_EMAIL),
    loginMethod: storage.getRaw(KEY_LOGIN_METHOD),
  };
}

// =======================================================
// 7) 구글 로그아웃 (localStorage 정리)
// =======================================================
export function googleLogout() {
  if (!isBrowser()) return;

  storage.removeRaw(KEY_GOOGLE_ID);
  storage.removeRaw(KEY_GOOGLE_NICKNAME);
  storage.removeRaw(KEY_GOOGLE_PROFILE_IMAGE);
  storage.removeRaw(KEY_LOGIN_METHOD);
  storage.removeRaw(KEY_ID_TOKEN);
  storage.removeRaw(KEY_ACCESS_TOKEN);
  storage.removeRaw(KEY_USER_EMAIL);

  storage.clearSession();
}
