// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 관리자 인증 쿠키 이름
const ADMIN_COOKIE = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";

// ── JWT payload 디코딩 (클레임 확인용)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Edge Runtime에서는 Buffer가 없으므로 atob 사용
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ── admin 그룹 소속 여부 확인
function isAdminToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const groups = payload["cognito:groups"];
  return Array.isArray(groups) && groups.includes("admin");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ API 경로는 middleware 완전히 제외
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // ▼ 1. 관리자 경로 판별
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLogin = pathname.startsWith("/admin/login");

  // 관리자 토큰(쿠키) + admin 그룹 검증
  const adminToken = req.cookies.get(ADMIN_COOKIE)?.value || null;
  const isAdminAuthed =
    adminToken && adminToken.length > 20 && isAdminToken(adminToken);

  // ▼ 2. 관리자 경로가 아닌 경우: 전부 통과
  if (!isAdminPath) {
    return NextResponse.next();
  }

  // ▼ 3. 관리자 페이지는 캐시 금지
  const res = NextResponse.next();
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("Surrogate-Control", "no-store");

  // ▼ 4. 인증되지 않은 관리자 → 로그인 페이지로
  if (!isAdminAuthed && !isAdminLogin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // ▼ 5. 이미 로그인한 관리자는 /admin/login 접근 불가 → 대시보드로
  if (isAdminAuthed && isAdminLogin) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  // ▼ 6. 그 외 관리자 페이지 → 통과
  return res;
}

// ✅ matcher는 단순하게 /admin/* 만 적용
export const config = {
  matcher: ["/admin/:path*"],
};
