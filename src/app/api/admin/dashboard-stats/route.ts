// src/app/api/admin/dashboard-stats/route.ts
// ==========================================
// GET /api/admin/dashboard-stats — 대시보드 통계
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function resolveUpstreamBase(): string | null {
  const base =
    process.env.ADMIN_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL;

  if (!base) return null;
  return base.replace(/\/$/, "");
}

function getAdminToken(): string | null {
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

export async function GET() {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/admin/dashboard-stats`;

    console.log("[Dashboard Stats GET] upstream:", url);

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
    console.error("[Dashboard Stats GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard stats" },
      { status: 500 }
    );
  }
}
