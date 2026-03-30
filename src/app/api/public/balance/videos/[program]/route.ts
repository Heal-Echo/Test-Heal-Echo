// src/app/api/public/balance/videos/[program]/route.ts
// =======================================================
// 공개용 Balance 영상 목록 조회 API (프로그램별)
// GET /api/public/balance/videos/{program}
//
// ✅ A단계(연결 확인) 임시 해결:
// - upstream(/balance/videos/{program})이 401을 주는 경우가 있어,
//   브라우저에 관리자 쿠키가 존재하면 그 토큰을 읽어 Authorization Bearer로 전달한다.
// - 관리자 쿠키가 없으면 Authorization 없이 호출한다(그대로 401 가능)
//
// ⚠️ 서비스용 "진짜 공개 API"는 다음 단계에서 별도 구축 권장
// =======================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function resolveUpstreamBase(): string | null {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
    process.env.ADMIN_API_GATEWAY_URL;

  if (!base) return null;
  return base.replace(/\/$/, "");
}

export async function GET(
  _req: Request,
  { params }: { params: { program: string } }
) {
  try {
    const base = resolveUpstreamBase();
    if (!base) {
      return NextResponse.json(
        { error: "Upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const program = params.program;
    const url = `${base}/balance/videos/${encodeURIComponent(program)}`;

    // ✅ Authorization 헤더 우선 (일반 사용자) + 관리자 쿠키 폴백
    let token: string | undefined;
    const authHeader = _req.headers.get("authorization");
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2) token = parts[1];
    }
    if (!token) {
      const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
      token = cookies().get(cookieName)?.value;
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log("[Public Balance Videos] Using token for upstream.");
    } else {
      console.log("[Public Balance Videos] No token. Calling upstream without Authorization.");
    }

    console.log("[Public Balance Videos] Fetching from upstream:", url);

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await res.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data ?? {}, { status: res.status });
  } catch (err: any) {
    console.error("[Public Balance Videos] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to fetch public balance videos" },
      { status: 500 }
    );
  }
}
