// src/app/api/admin/weekly-habit/upload/route.ts
// =================================================
// POST /api/admin/weekly-habit/upload
// - 위클리 해빗 영상/썸네일 업로드용 presigned URL 발급
// - 기존 presign-upload 라우트 패턴과 동일
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

  const base = gatewayBase.endsWith("/") ? gatewayBase : `${gatewayBase}/`;
  const url = new URL("presign-upload", base);

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
