// src/app/api/user/watch-records/route.ts
// ==========================================
// POST /api/user/watch-records — 시청 기록 저장
// GET  /api/user/watch-records — 시청 기록 조회
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
    const url = `${base}/user/watch-records`;

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
    console.error("[User Watch Record POST] error:", err);
    return NextResponse.json({ error: "Failed to save watch record" }, { status: 500 });
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

    // 쿼리 파라미터 전달 (programId)
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");
    const qs = programId ? `?programId=${encodeURIComponent(programId)}` : "";
    const url = `${base}/user/watch-records${qs}`;

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
    console.error("[User Watch Record GET] error:", err);
    return NextResponse.json({ error: "Failed to load watch records" }, { status: 500 });
  }
}
