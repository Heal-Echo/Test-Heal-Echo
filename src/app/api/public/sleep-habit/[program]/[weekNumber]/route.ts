// src/app/api/public/sleep-habit/[program]/[weekNumber]/route.ts
// =============================================================
// GET /api/public/sleep-habit/{program}/{weekNumber}
// 사용자가 해당 주차의 수면 습관 목록을 조회하는 API
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
  { params }: { params: { program: string; weekNumber: string } }
) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const { program, weekNumber } = params;
    const url = `${base}/public/sleep-habit/${encodeURIComponent(program)}/${encodeURIComponent(weekNumber)}`;

    // 사용자 인증 토큰 (Cognito JWT) — Pattern A
    const token = getUserToken(req);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("[Public Sleep Habit] Fetching from upstream:", url);

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
    console.error("[Public Sleep Habit] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch sleep habit content" }, { status: 500 });
  }
}
