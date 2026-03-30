import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

function extractToken(req: NextRequest): string | undefined {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie
    .split("; ")
    .find((v) => v.startsWith("heal_admin_auth="))
    ?.split("=")[1];
}

export async function POST(
  req: NextRequest,
  context: { params: { program: string; weekNumber: string } }
) {
  const { program, weekNumber } = context.params;
  const body = await req.json();
  const token = extractToken(req);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${API_BASE}/balance/videos/${program}/${weekNumber}/multipart/initiate`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();

  try {
    return NextResponse.json(JSON.parse(text), { status: response.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: response.status });
  }
}
