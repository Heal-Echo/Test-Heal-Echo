// src/app/api/admin/users/[userId]/route.ts
// GET    /api/admin/users/{userId} — 회원 상세 조회
// PATCH  /api/admin/users/{userId} — 회원 정보 수정
// DELETE /api/admin/users/{userId} — 회원 삭제 (Cognito + DynamoDB 익명화)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function resolveAdminApiBase(): string | null {
  const candidates = [
    process.env.ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;
  return candidates[0].replace(/\/$/, "");
}

function getToken() {
  return cookies().get(process.env.ADMIN_AUTH_COOKIE || "heal_admin_auth")?.value;
}

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/admin/users/${encodeURIComponent(params.userId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const text = await response.text();

    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json ?? {}, { status: response.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: response.status });
    }
  } catch (err) {
    console.error("[Admin GetUser] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.text();
    const url = `${base}/admin/users/${encodeURIComponent(params.userId)}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();

    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json ?? {}, { status: response.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: response.status });
    }
  } catch (err) {
    console.error("[Admin UpdateUser] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  try {
    const base = resolveAdminApiBase();
    if (!base) {
      return NextResponse.json(
        { error: "Admin API upstream base URL is not configured." },
        { status: 500 }
      );
    }

    const token = getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${base}/admin/users/${encodeURIComponent(params.userId)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const text = await response.text();

    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json ?? {}, { status: response.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: response.status });
    }
  } catch (err) {
    console.error("[Admin DeleteUser] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
