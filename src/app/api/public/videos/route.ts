// src/app/api/public/videos/route.ts
// =======================================================
// 공개용 Introduction Video 조회 API
// 누구나 접근 가능 (로그인 필요 없음)
// Next.js → AWS API Gateway (HealechoHttpApi) 프록시
// =======================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 캐시 없이 항상 최신 데이터

import { NextResponse } from "next/server";

/**
 * 실제로 호출할 공개 API URL을 결정한다.
 *
 * 1순위: PUBLIC_INTRO_VIDEOS_URL (전체 URL)
 * 2순위: NEXT_PUBLIC_API_BASE_URL + "/public/videos"
 *
 * => 이렇게 해두면, AWS API Gateway에서
 *    정확한 Invoke URL을 그대로 .env에 넣어서 쓸 수 있다.
 */
function resolveUpstreamUrl(): string | null {
  const directUrl = process.env.PUBLIC_INTRO_VIDEOS_URL;
  if (directUrl && directUrl.trim().length > 0) {
    return directUrl.trim();
  }

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
    process.env.ADMIN_API_GATEWAY_URL;

  if (!base) {
    return null;
  }

  const trimmedBase = base.replace(/\/$/, "");
  return `${trimmedBase}/public/videos`;
}

export async function GET() {
  try {
    const url = resolveUpstreamUrl();

    if (!url) {
      console.error(
        "[Public Videos API] Upstream URL is not configured. " +
          "Check PUBLIC_INTRO_VIDEOS_URL or NEXT_PUBLIC_API_BASE_URL."
      );
      return NextResponse.json(
        {
          error: "Public videos upstream URL is not configured. (환경변수 설정 필요)",
        },
        { status: 500 }
      );
    }

    console.log("[Public Videos API] Fetching from upstream:", url);

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      console.warn("[Public Videos API] Upstream response is not valid JSON. Raw text:", text);
    }

    if (!res.ok) {
      // 여기서 4xx/5xx 는 전부 500으로 감싸서 보낸다.
      // (Next 라우트 404와 혼동되지 않도록)
      console.error(
        "[Public Videos API] Upstream returned error status:",
        res.status,
        "body:",
        text
      );
      return NextResponse.json(
        {
          error: "Upstream public videos API failed",
          upstreamStatus: res.status,
          upstreamBody: text,
        },
        { status: 500 }
      );
    }

    // 정상 응답
    return NextResponse.json(data ?? {}, { status: 200 });
  } catch (err: any) {
    console.error("[Public Videos API] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch public videos" }, { status: 500 });
  }
}
