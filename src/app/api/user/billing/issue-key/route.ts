// src/app/api/user/billing/issue-key/route.ts
// ==========================================
// POST /api/user/billing/issue-key — 빌링키 발급 프록시
// ==========================================
//
// Lambda(billing-issue-key)로 프록시
// Lambda가 토스 빌링키 발급 + PaymentsTable 저장 + SubscriptionsTable 업데이트를 처리
//
// API 계약:
//   Request:  { authKey, customerKey, programId, planType }
//   Response: { ok, billingKey?, cardLast4?, cardCompany?,
//               subscription?: { subscriptionType, startDate, trialEndDate },
//               error? }
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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.text();
    const url = `${base}/user/billing/issue-key`;

    console.log("[IssueKey Proxy] upstream:", url);

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
    console.error("[IssueKey Proxy] error:", err);
    return NextResponse.json(
      { ok: false, error: "빌링키 발급 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
