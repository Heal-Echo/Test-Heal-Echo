// src/app/api/public/auth/state/route.ts
// =======================================================
// OAuth CSRF state — POST 핸들러
// =======================================================
// 용도:
// - 소셜 로그인 시작 시 state를 서버 메모리에 저장 (POST → state 반환)
// - 서버 콜백에서 state를 검증 (verifyOAuthState — store.ts에서 export)
//
// 기존 문제:
// - sessionStorage에 state를 저장하면 인앱 브라우저/앱 전환 시 유실됨
// - 서버 메모리에 저장하면 어떤 환경에서든 안전하게 검증 가능
//
// 보안:
// - 1회용 (검증 후 즉시 삭제)
// - 5분 TTL (OAuth 흐름이 5분 이상 걸리면 만료)
// - crypto.randomUUID()로 예측 불가능한 값 생성

import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "./store";

// =======================================================
// POST 핸들러: 클라이언트에서 state 요청
// =======================================================
// 요청: { provider: "naver" | "google" | "apple" }
// 응답: { state: "uuid-..." }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body;

    if (!provider || !["kakao", "naver", "google", "apple"].includes(provider)) {
      return NextResponse.json(
        { error: "유효하지 않은 provider" },
        { status: 400 }
      );
    }

    const state = createOAuthState(provider);

    return NextResponse.json({ state });
  } catch {
    return NextResponse.json(
      { error: "state 생성 실패" },
      { status: 500 }
    );
  }
}
