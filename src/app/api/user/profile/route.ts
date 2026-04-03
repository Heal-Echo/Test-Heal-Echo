// src/app/api/user/profile/route.ts
// ==========================================
// PUT  /api/user/profile — 프로필 저장 (온보딩)
// GET  /api/user/profile — 프로필 조회
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveUpstreamBase, extractToken, validatePutBody } from "@/lib/apiProxy";

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

    const url = `${base}/user/profile`;

    console.log("[User Profile PUT] upstream:", url);

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
    console.error("[User Profile PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 }
    );
  }
}

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

    const url = `${base}/user/profile`;

    console.log("[User Profile GET] upstream:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const text = await res.text();
    console.log("[User Profile GET] status:", res.status, "raw response:", text.slice(0, 500));

    try {
      const parsed = JSON.parse(text);
      console.log("[User Profile GET] parsed keys:", Object.keys(parsed), "profileSetupDone:", parsed.profileSetupDone, "profile?:", !!parsed.profile);
      return NextResponse.json(parsed, { status: res.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: res.status });
    }
  } catch (err) {
    console.error("[User Profile GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
