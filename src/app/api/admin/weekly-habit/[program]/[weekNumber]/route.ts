// src/app/api/admin/weekly-habit/[program]/[weekNumber]/route.ts
// ===========================================================
// GET    /api/admin/weekly-habit/{program}/{weekNumber} — 특정 주차 조회
// POST   /api/admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 등록
// PUT    /api/admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 수정
// DELETE /api/admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 삭제
// ===========================================================

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

async function forwardJson(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  token: string,
  bodyText?: string
) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(method === "GET" || method === "DELETE"
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: method === "GET" || method === "DELETE" ? undefined : bodyText,
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { res, json };
}

type Ctx = { params: { program: string; weekNumber: string } };

function buildUpstreamUrl(base: string, program: string, weekNumber: string) {
  return `${base}/admin/weekly-habit/${encodeURIComponent(program)}/${encodeURIComponent(weekNumber)}`;
}

// ---------------- GET (특정 주차 조회) ----------------
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;
    const url = buildUpstreamUrl(base, program, weekNumber);

    console.log("[Weekly Habit Admin GET] upstream:", url);

    const { res, json } = await forwardJson(url, "GET", token);
    return NextResponse.json(json ?? {}, { status: res.status });
  } catch (err) {
    console.error("[Weekly Habit Admin GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch weekly habit content" },
      { status: 500 }
    );
  }
}

// ---------------- POST (콘텐츠 등록) ----------------
export async function POST(req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;
    const url = buildUpstreamUrl(base, program, weekNumber);
    const bodyText = await req.text();

    console.log("[Weekly Habit Admin POST] upstream:", url);

    const { res, json } = await forwardJson(url, "POST", token, bodyText);
    return NextResponse.json(json ?? {}, { status: res.status });
  } catch (err) {
    console.error("[Weekly Habit Admin POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create weekly habit content" },
      { status: 500 }
    );
  }
}

// ---------------- PUT (콘텐츠 수정) ----------------
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;
    const url = buildUpstreamUrl(base, program, weekNumber);
    const bodyText = await req.text();

    console.log("[Weekly Habit Admin PUT] upstream:", url);

    const { res, json } = await forwardJson(url, "PUT", token, bodyText);
    return NextResponse.json(json ?? {}, { status: res.status });
  } catch (err) {
    console.error("[Weekly Habit Admin PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to update weekly habit content" },
      { status: 500 }
    );
  }
}

// ---------------- DELETE (콘텐츠 삭제) ----------------
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;
    const url = buildUpstreamUrl(base, program, weekNumber);

    console.log("[Weekly Habit Admin DELETE] upstream:", url);

    const { res, json } = await forwardJson(url, "DELETE", token);
    return NextResponse.json(json ?? {}, { status: res.status });
  } catch (err) {
    console.error("[Weekly Habit Admin DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete weekly habit content" },
      { status: 500 }
    );
  }
}
