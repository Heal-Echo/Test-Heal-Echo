// src/app/api/user/habit-tracking/[weekNumber]/route.ts
// =====================================================
// GET /api/user/habit-tracking/{weekNumber}?program=xxx
// 사용자의 주차별 습관 체크 기록 조회
// =====================================================

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

/** Authorization 헤더 우선 → 쿠키 폴백 (Pattern A) */
function getUserToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2) return parts[1];
  }
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: { weekNumber: string } }
) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getUserToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { weekNumber } = params;

    // query string에서 program 파라미터 추출
    const { searchParams } = new URL(req.url);
    const program = searchParams.get("program") || "autobalance";

    const url = `${base}/user/habit-tracking/${encodeURIComponent(weekNumber)}?program=${encodeURIComponent(program)}`;

    console.log("[User Habit Tracking GET] upstream:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
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
    console.error("[User Habit Tracking GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch habit tracking records" },
      { status: 500 }
    );
  }
}
