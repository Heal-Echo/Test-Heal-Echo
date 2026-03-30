// src/app/api/admin/videos/[videoId]/route.ts
// ===========================================================
// PATCH /api/admin/videos/:videoId
// DELETE /api/admin/videos/:videoId
// ===========================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const gatewayBase = process.env.ADMIN_API_GATEWAY_URL;
const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

type Params = { params: { videoId: string } };

// ---------------- PATCH ----------------
export async function PATCH(req: Request, { params }: Params) {
  if (!gatewayBase)
    return NextResponse.json({ error: "API Gateway URL not configured" }, { status: 500 });

  const token = cookies().get(cookieName)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = `${gatewayBase}/videos/${params.videoId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: await req.text(),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// ---------------- DELETE ----------------
export async function DELETE(req: Request, { params }: Params) {
  if (!gatewayBase)
    return NextResponse.json({ error: "API Gateway URL not configured" }, { status: 500 });

  const token = cookies().get(cookieName)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = `${gatewayBase}/videos/${params.videoId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
