// src/app/api/admin/weekly-habit/[program]/route.ts
// ===================================================
// GET  /api/admin/weekly-habit/{program}  — 전체 주차 목록 조회
// POST /api/admin/weekly-habit/{program}  — (미사용, 등록은 [weekNumber] 경로에서)
// ===================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function resolveAdminApiBase(): string | null {
  const candidates = [
    process.env.ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;
  return candidates[0].replace(/\/$/, "");
}

function getAdminToken(): string | null {
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

export async function GET(_req: Request, { params }: { params: { program: string } }) {
  try {
    const { program } = params;

    const base = resolveAdminApiBase();
    if (!base) {
      console.error("[Weekly Habit Admin] Upstream base URL not configured.");
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/admin/weekly-habit/${encodeURIComponent(program)}`;

    console.log("[Weekly Habit Admin] Fetching from upstream:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
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
    console.error("[Weekly Habit Admin] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch weekly habit list" }, { status: 500 });
  }
}
