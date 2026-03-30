// src/app/api/admin/logout/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  const COOKIE_NAME = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

  const res = NextResponse.json({ success: true });

  // 🔥 인증 쿠키 삭제
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: false, // dev에서는 false, prod에서는 true로 자동 설정 권장
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  // 🔥 브라우저 캐시 강제 무효화 → 뒤로가기 보안 문제 해결 보조
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}
