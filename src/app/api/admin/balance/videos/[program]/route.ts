// src/app/api/admin/balance/videos/[program]/route.ts
// ===================================================
// GET /api/admin/balance/videos/{program}
// Balance 영상 목록 조회 (관리자)
// ===================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Balance(관리자) upstream base URL 결정 규칙
 * 1) ADMIN_API_GATEWAY_URL (서버 전용 권장)
 * 2) NEXT_PUBLIC_ADMIN_API_GATEWAY_URL
 * 3) NEXT_PUBLIC_API_BASE_URL (fallback)
 */
function resolveAdminApiBase(): string | null {
  const candidates = [
    process.env.ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;

  return candidates[0].replace(/\/$/, "");
}

export async function GET(
  _req: Request,
  { params }: { params: { program: string } }
) {
  try {
    const { program } = params;

    const base = resolveAdminApiBase();
    if (!base) {
      console.error(
        "[Balance Admin Videos] Upstream base URL not configured."
      );
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    // ✅ 핵심 수정: App Router 표준 방식으로 쿠키 읽기
    const token =
      cookies().get(process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/balance/videos/${encodeURIComponent(program)}`;

    console.log("[Balance Admin Videos] Fetching from upstream:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`, // ✅ 반드시 필요
      },
      cache: "no-store",
    });

    const text = await response.text();

    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json ?? {}, { status: response.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: response.status });
    }
  } catch (err) {
    console.error("[Balance Admin Videos] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch balance videos" },
      { status: 500 }
    );
  }
}
