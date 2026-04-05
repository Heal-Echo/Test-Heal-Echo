// src/auth/kakao.ts
// =======================================================
// 🟡 카카오 로그인 인증 모듈 (Cognito OIDC 연동)
// =======================================================

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { AUTH_KEYS } from "./constants";
import { KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI } from "@/config/constants";
import { KAKAO_REST_API_KEY_SERVER, KAKAO_CLIENT_SECRET } from "@/config/server-constants";

// =======================================================
// 카카오 OAuth 설정
// =======================================================
// 콜백 경로 (origin은 런타임에 동적 결정)
const KAKAO_CALLBACK_PATH = "/api/public/auth/kakao/callback";
// 서버 사이드 폴백용 (exchangeKakaoCode 등)
const KAKAO_REDIRECT_URI_FALLBACK = KAKAO_REDIRECT_URI;

/** 현재 origin 기반 카카오 redirect URI (클라이언트) 또는 환경 변수 폴백 (서버) */
function getKakaoRedirectUri(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
  }
  return KAKAO_REDIRECT_URI_FALLBACK;
}

// localStorage keys (constants.ts에서 중앙 관리)
const KEY_KAKAO_ID = AUTH_KEYS.KAKAO_ID;
const KEY_KAKAO_NICKNAME = AUTH_KEYS.KAKAO_NICKNAME;
const KEY_KAKAO_PROFILE_IMAGE = AUTH_KEYS.KAKAO_PROFILE_IMAGE;
const KEY_LOGIN_METHOD = AUTH_KEYS.LOGIN_METHOD;

const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_USER_EMAIL = AUTH_KEYS.USER_EMAIL;

// SSR 방지
function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 카카오 로그인 URL 생성 (직접 카카오 OAuth)
// =======================================================
export function getKakaoLoginUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: getKakaoRedirectUri(),
    response_type: "code",
    scope: "account_email", // 카카오계정 이메일 수집 (비즈니스 인증 필요)
    prompt: "login", // 매번 카카오 로그인 확인 화면 표시
  });
  if (state) params.set("state", state);

  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

// =======================================================
// 2) 카카오 인증 코드 → 토큰 교환 (서버 사이드 전용, 직접 카카오 호출)
//    ※ Cognito 연동 시에는 사용되지 않음 (하위 호환용 보존)
// =======================================================
export async function exchangeKakaoCode(
  code: string,
  serverOrigin?: string
): Promise<{
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
}> {
  const serverRestApiKey = KAKAO_REST_API_KEY_SERVER || KAKAO_REST_API_KEY;

  // 서버에서 호출 시 origin을 전달받아 동적 redirect URI 구성
  const redirectUri = serverOrigin
    ? `${serverOrigin}${KAKAO_CALLBACK_PATH}`
    : getKakaoRedirectUri();

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: serverRestApiKey,
      client_secret: KAKAO_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error_description || "카카오 토큰 교환 실패");
  }

  return res.json();
}

// =======================================================
// 3) 카카오 사용자 프로필 조회 (서버 사이드 전용)
//    ※ Cognito 연동 시에는 사용되지 않음 (하위 호환용 보존)
// =======================================================
export interface KakaoUserProfile {
  id: number;
  nickname: string;
  profileImage: string | null;
  email: string | null;
}

export async function getKakaoUserProfile(accessToken: string): Promise<KakaoUserProfile> {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });

  if (!res.ok) {
    throw new Error("카카오 사용자 정보 조회 실패");
  }

  const data = await res.json();

  return {
    id: data.id,
    nickname: data.kakao_account?.profile?.nickname || data.properties?.nickname || "",
    profileImage:
      data.kakao_account?.profile?.profile_image_url || data.properties?.profile_image || null,
    email: data.kakao_account?.email || null,
  };
}

// =======================================================
// 4) Cognito 카카오 로그인 정보 localStorage 저장 (클라이언트 전용)
//    Cognito에서 발급한 JWT 토큰을 저장
// =======================================================
export function saveCognitoKakaoSession(idToken: string, accessToken: string) {
  if (!isBrowser()) return;

  storage.setRaw(KEY_ID_TOKEN, idToken);
  storage.setRaw(KEY_ACCESS_TOKEN, accessToken);
  storage.setRaw(KEY_LOGIN_METHOD, "kakao");

  // Cognito JWT에서 사용자 정보 추출
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

    const nickname = payload.nickname || payload["cognito:username"] || payload.name || "";
    const email = payload.email || "";
    const sub = payload.sub || "";

    storage.setRaw(KEY_KAKAO_NICKNAME, nickname);
    storage.setRaw(KEY_KAKAO_ID, sub);
    if (email) storage.setRaw(KEY_USER_EMAIL, email);
  } catch {
    // JWT 파싱 실패 시에도 토큰은 저장됨
  }
}

// =======================================================
// 5) 직접 카카오 로그인 정보 저장 (하위 호환용 보존)
// =======================================================
export function saveKakaoSession(params: {
  kakaoId: string;
  nickname: string;
  profileImage: string | null;
  email: string | null;
  accessToken: string;
}) {
  if (!isBrowser()) return;

  storage.setRaw(KEY_KAKAO_ID, params.kakaoId);
  storage.setRaw(KEY_KAKAO_NICKNAME, params.nickname);
  storage.setRaw(KEY_LOGIN_METHOD, "kakao");
  storage.setRaw(KEY_ACCESS_TOKEN, params.accessToken);
  storage.setRaw(KEY_ID_TOKEN, params.accessToken);

  if (params.profileImage) {
    storage.setRaw(KEY_KAKAO_PROFILE_IMAGE, params.profileImage);
  }

  if (params.email) {
    storage.setRaw(KEY_USER_EMAIL, params.email);
  }
}

// =======================================================
// 6) 카카오 로그인 여부 확인
// =======================================================
export function isKakaoUser(): boolean {
  if (!isBrowser()) return false;
  return storage.getRaw(KEY_LOGIN_METHOD) === "kakao";
}

// =======================================================
// 7) 카카오 사용자 정보 반환
// =======================================================
export function getKakaoUserInfo() {
  if (!isBrowser()) return null;

  const kakaoId = storage.getRaw(KEY_KAKAO_ID);
  if (!kakaoId) return null;

  return {
    kakaoId,
    nickname: storage.getRaw(KEY_KAKAO_NICKNAME),
    profileImage: storage.getRaw(KEY_KAKAO_PROFILE_IMAGE),
    email: storage.getRaw(KEY_USER_EMAIL),
    loginMethod: storage.getRaw(KEY_LOGIN_METHOD),
  };
}

// =======================================================
// 8) 카카오 로그아웃 (localStorage 정리)
// =======================================================
export function kakaoLogout() {
  if (!isBrowser()) return;

  storage.removeRaw(KEY_KAKAO_ID);
  storage.removeRaw(KEY_KAKAO_NICKNAME);
  storage.removeRaw(KEY_KAKAO_PROFILE_IMAGE);
  storage.removeRaw(KEY_LOGIN_METHOD);
  storage.removeRaw(KEY_ID_TOKEN);
  storage.removeRaw(KEY_ACCESS_TOKEN);
  storage.removeRaw(KEY_USER_EMAIL);

  storage.clearSession();
}

// =======================================================
// 9) 쿠키 유틸리티 (Cognito 콜백 토큰 전달용)
//    ※ storage.ts 추상화 레이어로 이전 완료
//    ※ 하위 호환: 기존 import 경로 유지를 위한 re-export
// =======================================================
export { getCookie, deleteCookie } from "@/lib/storage";
