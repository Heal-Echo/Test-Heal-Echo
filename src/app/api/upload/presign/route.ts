// src/app/api/upload/presign/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const gatewayBase = process.env.ADMIN_API_GATEWAY_URL;
const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

export async function POST(req: Request) {
  if (!gatewayBase) {
    return NextResponse.json({ error: "ADMIN_API_GATEWAY_URL not configured" }, { status: 500 });
  }

  // 🔐 관리자 인증 (기존과 동일)
  const token = cookies().get(cookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const url = new URL("/presign-upload", gatewayBase);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
