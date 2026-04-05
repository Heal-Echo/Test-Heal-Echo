// src/app/api/public/auth/exchange/route.ts
// =======================================================
// 🔑 POST /api/public/auth/exchange
// 클라이언트가 교환 코드로 토큰을 수신하는 엔드포인트
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import { tokenStore, CODE_TTL_MS } from "./store";

// ─── IP 기반 Rate Limiting (브루트포스 방지) ───
// 같은 IP에서 1분에 10회까지만 허용
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// 만료된 항목 정리 (5분마다)
if (!(globalThis as any).__exchangeRateLimitCleanup__) {
  (globalThis as any).__exchangeRateLimitCleanup__ = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 5 * 60_000);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "교환 코드가 필요합니다." }, { status: 400 });
    }

    // 저장소에서 조회
    const stored = tokenStore.get(code);

    if (!stored) {
      return NextResponse.json(
        { error: "유효하지 않거나 만료된 교환 코드입니다." },
        { status: 404 }
      );
    }

    // TTL 확인
    if (Date.now() - stored.createdAt > CODE_TTL_MS) {
      tokenStore.delete(code);
      return NextResponse.json({ error: "교환 코드가 만료되었습니다." }, { status: 410 });
    }

    // 1회용: 즉시 삭제
    tokenStore.delete(code);

    // 토큰 반환
    return NextResponse.json({
      idToken: stored.idToken,
      accessToken: stored.accessToken,
      provider: stored.provider,
    });
  } catch {
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
