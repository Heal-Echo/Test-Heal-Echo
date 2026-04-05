// src/app/api/admin/multipart/part/route.ts
// =================================================
// POST /api/admin/multipart/part
// - Introduction 영상 multipart 업로드용 part 프록시
// =================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const gatewayBase = process.env.ADMIN_API_GATEWAY_URL;
const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

// CORS preflight
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    },
  });
}

export async function POST(req: Request) {
  if (!gatewayBase) {
    return NextResponse.json({ error: "ADMIN_API_GATEWAY_URL not configured" }, { status: 500 });
  }

  const token = cookies().get(cookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();

  // gatewayBase + "multipart/part"
  const base = gatewayBase.endsWith("/") ? gatewayBase : `${gatewayBase}/`;
  const url = new URL("multipart/part", base);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: rawBody,
    cache: "no-store",
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
