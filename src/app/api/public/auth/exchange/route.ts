// src/app/api/public/auth/exchange/route.ts
// =======================================================
// 🔑 POST /api/public/auth/exchange
// 클라이언트가 교환 코드로 토큰을 수신하는 엔드포인트
// =======================================================

import { NextRequest, NextResponse } from "next/server";
import { tokenStore, CODE_TTL_MS } from "./store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "교환 코드가 필요합니다." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "교환 코드가 만료되었습니다." },
        { status: 410 }
      );
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
    return NextResponse.json(
      { error: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
