// src/app/api/admin/balance/videos/[program]/[weekNumber]/route.ts
// ===========================================================
// PATCH /api/admin/balance/videos/:program/:weekNumber
// DELETE /api/admin/balance/videos/:program/:weekNumber
//
// 목적:
// - Balance(Weekly Solution) 전용 수정/삭제 프록시
// - Introduction(/api/admin/videos/*)과 완전히 분리
//
// 이번 대응:
// - upstream에서 PATCH가 404(Not Found)인 경우가 확인됨
// - 따라서 PATCH 404일 때에만 POST/PUT fallback을 "안전하게" 재시도
//   (정상적으로 PATCH가 지원되는 환경에는 영향 없음)
// ===========================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Balance(관리자) upstream base URL 결정 규칙
 * - 이 로직은 기존 balance 목록 라우트와 동일
 */
function resolveAdminApiBase(): string | null {
  const candidates = [
    process.env.ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;
  return candidates[0].replace(/\/$/, "");
}

type Ctx = { params: { program: string; weekNumber: string } };

function getAdminToken(): string | null {
  const cookieName = process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth";
  return cookies().get(cookieName)?.value ?? null;
}

async function forwardJson(
  url: string,
  method: "PATCH" | "POST" | "PUT" | "DELETE",
  token: string,
  bodyText?: string
) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(method === "DELETE" ? {} : { "Content-Type": "application/json" }),
    },
    body: method === "DELETE" ? undefined : bodyText,
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { res, json };
}

// ---------------- PATCH (수정) ----------------
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;

    // upstream 기본 후보 (현재 우리가 사용한 경로)
    const upstreamUrl = `${base}/balance/videos/${encodeURIComponent(
      program
    )}/${encodeURIComponent(weekNumber)}`;

    const bodyText = await req.text();

    // 1) 기본: PATCH 시도
    const first = await forwardJson(upstreamUrl, "PATCH", token, bodyText);

    // ✅ PATCH가 지원되면 여기서 끝
    if (first.res.status !== 404) {
      return NextResponse.json(first.json ?? {}, { status: first.res.status });
    }

    // 2) fallback #1: POST 시도 (PATCH 미지원 API 대비)
    const second = await forwardJson(upstreamUrl, "POST", token, bodyText);
    if (second.res.status !== 404) {
      return NextResponse.json(second.json ?? {}, { status: second.res.status });
    }

    // 3) fallback #2: PUT 시도
    const third = await forwardJson(upstreamUrl, "PUT", token, bodyText);
    if (third.res.status !== 404) {
      return NextResponse.json(third.json ?? {}, { status: third.res.status });
    }

    // 여기까지 왔으면 upstream이 정말로 이 경로 자체를 모르는 상태
    // -> 다음 단계에서 upstream 경로를 확정해야 함
    return NextResponse.json(
      {
        error: "Upstream endpoint not found for update",
        tried: [
          { method: "PATCH", url: upstreamUrl },
          { method: "POST", url: upstreamUrl },
          { method: "PUT", url: upstreamUrl },
        ],
        upstreamLastResponse: third.json ?? null,
      },
      { status: 404 }
    );
  } catch (err) {
    console.error("[Balance Admin Video UPDATE] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to update balance video" }, { status: 500 });
  }
}

// ---------------- DELETE (삭제) ----------------
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getAdminToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { program, weekNumber } = params;

    const upstreamUrl = `${base}/balance/videos/${encodeURIComponent(
      program
    )}/${encodeURIComponent(weekNumber)}`;

    const { res, json } = await forwardJson(upstreamUrl, "DELETE", token);

    return NextResponse.json(json ?? {}, { status: res.status });
  } catch (err) {
    console.error("[Balance Admin Video DELETE] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to delete balance video" }, { status: 500 });
  }
}
