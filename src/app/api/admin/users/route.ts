// src/app/api/admin/users/route.ts
// GET /api/admin/users — 회원 목록 조회

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

export async function GET(req: Request) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token =
      cookies().get(process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 쿼리 파라미터 전달 (search, type, limit, lastKey)
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const url = `${base}/admin/users${qs ? `?${qs}` : ""}`;

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
    console.error("[Admin Users] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
