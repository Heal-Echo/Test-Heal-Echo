// src/app/api/admin/presign-upload/route.ts
// =================================================
// POST /api/admin/presign-upload
// OPTIONS /api/admin/presign-upload
// - API Gateway URL에 stage path가 포함된 경우를 안전하게 처리
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

  // body를 파싱하지 않고 그대로 전달
  const rawBody = await req.text();

  // ✅ 중요: gatewayBase에 /prod 같은 path가 있어도 유지되도록 '상대경로'로 붙인다
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
