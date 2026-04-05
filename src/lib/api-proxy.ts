// src/lib/apiProxy.ts
// =======================================================
// API Route (proxy) shared utilities
// - resolveUpstreamBase: upstream API Gateway URL
// - extractToken: Bearer token from Authorization header
// - validatePutBody: basic PUT request validation
// =======================================================

import { NextResponse } from "next/server";
import { UPSTREAM_BASE_URL } from "@/config/server-constants";

/**
 * Upstream API Gateway base URL
 * Returns null if not configured
 */
export function resolveUpstreamBase(): string | null {
  if (!UPSTREAM_BASE_URL) return null;
  return UPSTREAM_BASE_URL.replace(/\/$/, "");
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts.length === 2 ? parts[1] : null;
}

// Maximum body size: 64KB (profile/preferences are small JSON)
const MAX_BODY_SIZE = 64 * 1024;

/**
 * Validate PUT request body
 * - Checks Content-Type is application/json
 * - Checks body size does not exceed limit
 * - Returns { body, error } — if error is set, return it as the response
 */
export async function validatePutBody(
  req: Request
): Promise<{ body: string; error: null } | { body: null; error: NextResponse }> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      body: null,
      error: NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 }),
    };
  }

  const rawBody = await req.text();

  if (rawBody.length > MAX_BODY_SIZE) {
    return {
      body: null,
      error: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    };
  }

  return { body: rawBody, error: null };
}
