// src/app/api/admin/login/route.ts
// 관리자 로그인 (Cognito + httpOnly Cookie + admin 그룹 검증)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

// ── JWT payload 디코딩 (서명 검증 없이 클레임만 추출)
// middleware에서 이중 검증하므로 여기서는 클레임 확인용으로만 사용
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = parts[1];
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded);
}

// ── admin 그룹 소속 여부 확인
function isAdminUser(idToken: string): boolean {
  try {
    const payload = decodeJwtPayload(idToken);
    const groups = payload["cognito:groups"];
    if (Array.isArray(groups) && groups.includes("admin")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

type LoginBody = {
  email: string;
  password?: string;
  newPassword?: string;
  session?: string;
  step?: "init" | "completeNewPassword";
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[admin/login] Missing env: ${name}`);
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

const isProd = process.env.NODE_ENV === "production";
const COOKIE_SECURE = isProd ? true : false;
const COOKIE_SAMESITE = isProd ? "strict" : "lax";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const { email, password, newPassword, session, step = "init" } = body;

    // ── 필수 환경변수
    const USER_POOL = requiredEnv("COGNITO_ADMIN_USER_POOL_ID");
    const CLIENT_ID = requiredEnv("COGNITO_ADMIN_CLIENT_ID");
    const REGION = requiredEnv("COGNITO_ADMIN_REGION");
    const COOKIE_NAME = requiredEnv("ADMIN_AUTH_COOKIE");

    // ── 선택(없어도 됨)
    const CLIENT_SECRET = process.env.COGNITO_ADMIN_CLIENT_SECRET ?? null;
    const hasSecret = !!CLIENT_SECRET;

    if (!email) {
      return NextResponse.json(
        { error: "이메일이 필요합니다." },
        { status: 400 }
      );
    }

    const cognitoUrl = `https://cognito-idp.${REGION}.amazonaws.com/`;

    // ─────────────────────────────
    // STEP 1 — 기존 비밀번호 로그인
    // ─────────────────────────────
    if (step === "init") {
      if (!password) {
        return NextResponse.json(
          { error: "비밀번호가 필요합니다." },
          { status: 400 }
        );
      }

      // AuthParameters 구성
      const authParams: Record<string, string> = {
        USERNAME: email,
        PASSWORD: password,
      };

      // Client Secret이 있을 때만 SECRET_HASH 추가
      if (hasSecret && CLIENT_SECRET) {
        const secretHash = crypto
          .createHmac("SHA256", CLIENT_SECRET)
          .update(email + CLIENT_ID)
          .digest("base64");
        authParams.SECRET_HASH = secretHash;
      }

      const authRes = await fetch(cognitoUrl, {
        method: "POST",
        headers: {
          "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
          "Content-Type": "application/x-amz-json-1.1",
        },
        body: JSON.stringify({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: CLIENT_ID,
          AuthParameters: authParams,
        }),
      });

      const data = await authRes.json();
      console.log("[LOGIN INIT]", data);

      if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
        return NextResponse.json(
          { requiresNewPassword: true, session: data.Session },
          { status: 200 }
        );
      }

      const idToken = data.AuthenticationResult?.IdToken;
      if (!idToken) {
        return NextResponse.json(
          { error: "로그인에 실패했습니다." },
          { status: 401 }
        );
      }

      // ── admin 그룹 검증
      if (!isAdminUser(idToken)) {
        return NextResponse.json(
          { error: "관리자 권한이 없습니다." },
          { status: 403 }
        );
      }

      const res = NextResponse.json({ success: true });

      res.cookies.set(COOKIE_NAME, idToken, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        path: "/",
      });

      return res;
    }

    // ─────────────────────────────
    // STEP 2 — NEW_PASSWORD_REQUIRED 처리
    // ─────────────────────────────
    if (step === "completeNewPassword") {
      if (!newPassword || !session) {
        return NextResponse.json(
          { error: "새 비밀번호/세션이 필요합니다." },
          { status: 400 }
        );
      }

      const challengeParams: Record<string, string> = {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
      };

      if (hasSecret && CLIENT_SECRET) {
        const secretHash = crypto
          .createHmac("SHA256", CLIENT_SECRET)
          .update(email + CLIENT_ID)
          .digest("base64");
        challengeParams.SECRET_HASH = secretHash;
      }

      const challengeRes = await fetch(cognitoUrl, {
        method: "POST",
        headers: {
          "X-Amz-Target":
            "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
          "Content-Type": "application/x-amz-json-1.1",
        },
        body: JSON.stringify({
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          ClientId: CLIENT_ID,
          Session: session,
          ChallengeResponses: challengeParams,
        }),
      });

      const data = await challengeRes.json();
      console.log("[LOGIN COMPLETE NEW PASSWORD]", data);

      const idToken = data.AuthenticationResult?.IdToken;
      if (!idToken) {
        return NextResponse.json(
          { error: "로그인 토큰이 없습니다." },
          { status: 401 }
        );
      }

      // ── admin 그룹 검증
      if (!isAdminUser(idToken)) {
        return NextResponse.json(
          { error: "관리자 권한이 없습니다." },
          { status: 403 }
        );
      }

      const res = NextResponse.json({ success: true });

      res.cookies.set(COOKIE_NAME, idToken, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        path: "/",
      });

      return res;
    }

    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
