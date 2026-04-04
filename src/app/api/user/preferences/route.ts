// src/app/api/user/preferences/route.ts
// ==========================================
// GET  /api/user/preferences — 환경설정 조회
// PUT  /api/user/preferences — 환경설정 저장 (부분 업데이트)
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveUpstreamBase, extractToken, validatePutBody } from "@/lib/apiProxy";

export async function GET(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/user/preferences`;

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
    console.error("[User Preferences GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { body: rawBody, error: validationError } = await validatePutBody(req);
    if (validationError) return validationError;

    const url = `${base}/user/preferences`;

    const res = await fetch(url, {
      method: "PUT",
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
    console.error("[User Preferences PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
