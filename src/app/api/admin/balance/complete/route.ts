// src/app/api/admin/balance/complete/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE =
  process.env.ADMIN_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { program, weekNumber } = body;

    // 필수 값 검증
    if (!program || !weekNumber) {
      return NextResponse.json(
        { message: "program and weekNumber are required" },
        { status: 400 }
      );
    }

    if (!API_BASE) {
      return NextResponse.json(
        { message: "API base URL not configured" },
        { status: 500 }
      );
    }

    // 🔥 여기서는 인증을 전혀 검사하지 않음
    // 관리자 인증은 middleware.ts에서 이미 처리됨

    const res = await fetch(
      `${API_BASE.replace(/\/$/, "")}/balance/videos/${program}/${weekNumber}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const text = await res.text();

    return NextResponse.json(
      text ? JSON.parse(text) : {},
      { status: res.status }
    );
  } catch (err) {
    console.error("[Balance Complete Route] error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
