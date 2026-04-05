// src/app/api/public/weekly-habit/[program]/[weekNumber]/route.ts
// =============================================================
// GET /api/public/weekly-habit/{program}/{weekNumber}
// 사용자가 해당 주차의 습관 콘텐츠를 조회하는 API
// (영상 URL, 습관 제목, 습관 설명, 습관 항목 리스트)
// =============================================================

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

export async function GET(
  _req: Request,
  { params }: { params: { program: string; weekNumber: string } }
) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const { program, weekNumber } = params;
    const url = `${base}/public/weekly-habit/${encodeURIComponent(program)}/${encodeURIComponent(weekNumber)}`;

    // ✅ Authorization 헤더 우선 (일반 사용자) + 관리자 쿠키 폴백
    let token: string | undefined;
    const authHeader = _req.headers.get("authorization");
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2) token = parts[1];
    }
    if (!token) {
      const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
      token = cookies().get(cookieName)?.value;
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("[Public Weekly Habit] Fetching from upstream:", url);

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await res.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data ?? {}, { status: res.status });
  } catch (err: any) {
    console.error("[Public Weekly Habit] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch weekly habit content" }, { status: 500 });
  }
}
