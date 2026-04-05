// src/app/api/user/billing/info/route.ts
// ==========================================
// GET /api/user/billing/info — 결제 정보 조회 프록시
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function resolveUpstreamBase(): string | null {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
    process.env.ADMIN_API_GATEWAY_URL;

  if (!base) return null;
  return base.replace(/\/$/, "");
}

function getUserToken(req: Request): string | null {
  // 1) Authorization 헤더 우선 (일반 사용자)
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2) return parts[1];
  }
  // 2) 쿠키 폴백 (관리자 세션)
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

export async function GET(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const token = getUserToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") || "autobalance";
    const url = `${base}/user/billing/info?programId=${programId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const text = await res.text();

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: res.status });
    }
  } catch (err) {
    console.error("[Billing Info GET] error:", err);
    return NextResponse.json({ error: "Failed to load billing info" }, { status: 500 });
  }
}
