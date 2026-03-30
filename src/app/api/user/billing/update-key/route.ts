// src/app/api/user/billing/update-key/route.ts
// ==========================================
// POST /api/user/billing/update-key — 결제 수단 변경 프록시
// ==========================================
//
// Lambda(billing-update-key)로 프록시
// Lambda가 토스 빌링키 재발급 + PaymentsTable 업데이트를 처리
// ★ SubscriptionsTable은 건드리지 않음 (구독 상태 유지)
//
// API 계약:
//   Request:  { authKey, customerKey, programId }
//   Response: { ok, cardLast4?, cardCompany?, error? }
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function resolveUpstreamBase(): string | null {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
    process.env.ADMIN_API_GATEWAY_URL;

  if (!base) return null;
  return base.replace(/\/$/, "");
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts.length === 2 ? parts[1] : null;
}

export async function POST(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { ok: false, error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    const url = `${base}/user/billing/update-key`;

    console.log("[UpdateKey Proxy] upstream:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: rawBody,
      cache: "no-store",
    });

    const text = await res.text();

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: res.status });
    }
  } catch (err) {
    console.error("[UpdateKey Proxy] error:", err);
    return NextResponse.json(
      { ok: false, error: "결제 수단 변경 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
