// src/auth/constants.ts
// =======================================================
// 🔑 인증 관련 Storage 키 상수 (Single Source of Truth)
// =======================================================
// 목적:
//   인증 토큰, 로그인 방식, 소셜 로그인 프로필 등의 키 이름을
//   한 곳에서 관리하여 누락·불일치를 방지합니다.
//
// 사용처:
//   user.ts, kakao.ts, naver.ts, google.ts, apple.ts, tokenManager.ts
//   — 각 파일에서 import { AUTH_KEYS } from "./constants" 로 참조
//
// 키 분류:
//   1. 공통 키: 모든 로그인 방식에서 공유 (토큰, 이메일, 로그인 방식)
//   2. 카카오 전용 키
//   3. 네이버 전용 키
//   4. 구글 전용 키
//   5. 애플 전용 키
// =======================================================

export const AUTH_KEYS = {
  // ----- 공통 (모든 로그인 방식에서 사용) -----
  ID_TOKEN: "user_id_token",
  ACCESS_TOKEN: "user_access_token",
  USER_EMAIL: "user_email",
  LOGIN_METHOD: "user_login_method",

  // ----- 카카오 전용 -----
  KAKAO_ID: "user_kakao_id",
  KAKAO_NICKNAME: "user_kakao_nickname",
  KAKAO_PROFILE_IMAGE: "user_kakao_profile_image",

  // ----- 네이버 전용 -----
  NAVER_ID: "user_naver_id",
  NAVER_NICKNAME: "user_naver_nickname",
  NAVER_PROFILE_IMAGE: "user_naver_profile_image",

  // ----- 구글 전용 -----
  GOOGLE_ID: "user_google_id",
  GOOGLE_NICKNAME: "user_google_nickname",
  GOOGLE_PROFILE_IMAGE: "user_google_profile_image",

  // ----- 애플 전용 -----
  APPLE_ID: "user_apple_id",
  APPLE_NICKNAME: "user_apple_nickname",
} as const;
