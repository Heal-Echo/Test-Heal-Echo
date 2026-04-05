// src/app/api/admin/videos/route.ts
// ==========================================
// GET /api/admin/videos
// Introduction 영상 목록 조회 (관리자)
// Public API (/public/videos) 재사용
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const gatewayBase = process.env.PUBLIC_API_GATEWAY_URL;
const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

export async function GET() {
  if (!gatewayBase) {
    return NextResponse.json({ error: "Public API Gateway URL not configured" }, { status: 500 });
  }

  // 🔐 관리자 인증은 유지 (접근 제어용)
  const token = cookies().get(cookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ 핵심 수정: /public/videos 로 호출
  const url = new URL("/public/videos", gatewayBase);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
