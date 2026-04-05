// src/app/api/public/auth/check-login-method/route.ts
// =======================================================
// 🔍 사용자 로그인 방법 확인 API
// =======================================================
// 이메일 로그인 실패 시 호출 → 가입 경로(소셜/이메일) 확인
// 1차: custom:signup_method 속성으로 판별 (신규 가입자)
// 2차: nickname/given_name 속성으로 추론 (기존 가입자 — 속성 미설정)

import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// ─── IP 기반 Rate Limiting (이메일 열거 방지) ───
// 같은 IP에서 1분에 5회까지만 허용
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// 만료된 항목 정리 (5분마다)
if (!(globalThis as any).__checkLoginMethodCleanup__) {
  (globalThis as any).__checkLoginMethodCleanup__ = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 5 * 60_000);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-northeast-2";
const USER_POOL_ID =
  process.env.COGNITO_ADMIN_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// 가입 경로별 한글 표시명
const METHOD_LABELS: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "구글",
  apple: "애플",
  email: "이메일",
};

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { exists: false, isSocialUser: false, signupMethod: null, methodLabel: null },
        { status: 400 }
      );
    }

    // Cognito에서 사용자 조회
    const user = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    );

    // 속성 확인
    const attrs = user.UserAttributes || [];

    // 1차: custom:signup_method 속성으로 판별 (정확)
    const signupMethodAttr = attrs.find((a) => a.Name === "custom:signup_method");
    const signupMethod = signupMethodAttr?.Value || null;

    if (signupMethod) {
      const isSocialUser = signupMethod !== "email";
      const methodLabel = METHOD_LABELS[signupMethod] || signupMethod;
      return NextResponse.json({
        exists: true,
        isSocialUser,
        signupMethod,
        methodLabel,
      });
    }

    // 2차: 기존 가입자 (custom:signup_method 미설정) → 속성 기반 추론
    const hasGivenName = attrs.some((a) => a.Name === "given_name" && a.Value);
    const hasNickname = attrs.some((a) => a.Name === "nickname" && a.Value);

    // 소셜 가입 사용자: nickname O, given_name X
    const isSocialUser = hasNickname && !hasGivenName;

    return NextResponse.json({
      exists: true,
      isSocialUser,
      signupMethod: isSocialUser ? "social" : "email",
      methodLabel: isSocialUser ? "소셜" : "이메일",
    });
  } catch (err: any) {
    if (err.name === "UserNotFoundException") {
      return NextResponse.json({
        exists: false,
        isSocialUser: false,
        signupMethod: null,
        methodLabel: null,
      });
    }

    console.error("[check-login-method 에러]", err.message || err);
    return NextResponse.json(
      { exists: false, isSocialUser: false, signupMethod: null, methodLabel: null },
      { status: 500 }
    );
  }
}
