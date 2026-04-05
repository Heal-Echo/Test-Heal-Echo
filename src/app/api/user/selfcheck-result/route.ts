// src/app/api/user/selfcheck-result/route.ts
// ==========================================
// POST /api/user/selfcheck-result — 자가 체크 결과 저장
// GET  /api/user/selfcheck-result — 자가 체크 결과 조회
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
  // 1) Authorization 헤더 우선 (일반 사용자 localStorage 토큰)
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2) return parts[1];
  }
  // 2) 폴백: 관리자 쿠키
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

export async function POST(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const token = getUserToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.text();
    const url = `${base}/user/selfcheck-result`;

    console.log("[User SelfCheck Result POST] upstream:", url);

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
    console.error("[User SelfCheck Result POST] error:", err);
    return NextResponse.json({ error: "Failed to save self-check result" }, { status: 500 });
  }
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

    const url = `${base}/user/selfcheck-result`;

    console.log("[User SelfCheck Result GET] upstream:", url);

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
    console.error("[User SelfCheck Result GET] error:", err);
    return NextResponse.json({ error: "Failed to load self-check results" }, { status: 500 });
  }
}
