// src/app/api/public/auth/exchange/store.ts
// =======================================================
// 🔑 일회용 인증 교환 코드 — 토큰 저장소 & 코드 생성
// =======================================================
// route.ts에서 분리: Next.js Route Handler는 HTTP 메서드만 export 가능.
// 이 모듈은 소셜 로그인 콜백 라우트에서 import하여 사용합니다.
// =======================================================

import crypto from "crypto";

// =======================================================
// 인메모리 토큰 저장소
// =======================================================

interface StoredTokens {
  idToken: string;
  accessToken: string;
  provider: string; // "kakao" | "naver" | "google" | "apple"
  createdAt: number;
}

/** 교환 코드 → 토큰 매핑 (서버 메모리) */
export const tokenStore = new Map<string, StoredTokens>();

/** TTL: 60초 */
export const CODE_TTL_MS = 60_000;

/** 만료된 코드 정리 (10분마다 자동 실행) */
const CLEANUP_INTERVAL_MS = 10 * 60_000;

// 주기적 정리 타이머 (서버 프로세스 수명 동안 유지)
if (typeof globalThis !== "undefined") {
  // Next.js 핫 리로드 시 중복 타이머 방지
  const globalKey = "__authCodeCleanupTimer__";
  const g = globalThis as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = setInterval(() => {
      const now = Date.now();
      for (const [code, data] of tokenStore.entries()) {
        if (now - data.createdAt > CODE_TTL_MS) {
          tokenStore.delete(code);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }
}

// =======================================================
// 교환 코드 생성
// =======================================================

/**
 * Cognito 토큰을 저장하고 일회용 교환 코드를 반환합니다.
 * 각 소셜 로그인 콜백 라우트에서 호출합니다.
 *
 * @param idToken    - Cognito ID 토큰 (JWT)
 * @param accessToken - Cognito Access 토큰
 * @param provider   - 로그인 제공자 ("kakao" | "naver" | "google" | "apple")
 * @returns 일회용 교환 코드 (UUID)
 */
export function createAuthCode(
  idToken: string,
  accessToken: string,
  provider: string
): string {
  const code = crypto.randomUUID();

  tokenStore.set(code, {
    idToken,
    accessToken,
    provider,
    createdAt: Date.now(),
  });

  return code;
}
