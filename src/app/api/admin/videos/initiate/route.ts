// src/app/api/admin/videos/initiate/route.ts
// ==================================================
// POST /api/admin/videos/initiate
// Presigned URL 발급
// ==================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const gatewayBase = process.env.ADMIN_API_GATEWAY_URL;
const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

export async function POST(req: Request) {
  if (!gatewayBase) {
    return NextResponse.json({ error: "API Gateway URL not configured" }, { status: 500 });
  }

  const token = cookies().get(cookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const url = `${gatewayBase}/videos/initiate`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
