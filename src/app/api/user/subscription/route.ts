// src/app/api/user/subscription/route.ts
// ==========================================
// GET  /api/user/subscription?programId=autobalance — 구독 조회
// PUT  /api/user/subscription — 구독 저장/갱신
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveUpstreamBase, extractToken, validatePutBody } from "@/lib/api-proxy";

export async function GET(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // query params 전달
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const url = `${base}/user/subscription${qs ? `?${qs}` : ""}`;

    console.log("[User Subscription GET] upstream:", url);

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
    console.error("[User Subscription GET] error:", err);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json({ error: "Upstream base URL is not configured." }, { status: 500 });
    }

    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { body: rawBody, error: validationError } = await validatePutBody(req);
    if (validationError) return validationError;

    const url = `${base}/user/subscription`;

    console.log("[User Subscription PUT] upstream:", url);

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
    console.error("[User Subscription PUT] error:", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
