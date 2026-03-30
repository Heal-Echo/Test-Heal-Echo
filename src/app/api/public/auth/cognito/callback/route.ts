// src/app/api/public/auth/cognito/callback/route.ts
// =======================================================
// Cognito OAuth 콜백 핸들러
// 카카오 → Cognito OIDC → 이 콜백 → 프론트엔드
// =======================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  const loginPageUrl = new URL("/public/login", req.url);

  // ─── 에러 처리 ───
  if (error) {
    const errorMsg = encodeURIComponent(errorDescription || error);
    loginPageUrl.searchParams.set("cognito_error", errorMsg);
    return NextResponse.redirect(loginPageUrl);
  }

  if (!code) {
    loginPageUrl.searchParams.set(
      "cognito_error",
      encodeURIComponent("인증 코드가 없습니다")
    );
    return NextResponse.redirect(loginPageUrl);
  }

  // ─── Cognito 토큰 교환 ───
  try {
    const cognitoDomain =
      process.env.COGNITO_DOMAIN ||
      "https://healecho-admin.auth.ap-northeast-2.amazoncognito.com";
    const clientId =
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
    const redirectUri =
      process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URI ||
      "http://localhost:3000/api/public/auth/cognito/callback";

    const tokenRes = await fetch(`${cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      throw new Error(
        errorData.error_description || errorData.error || "토큰 교환 실패"
      );
    }

    const tokens = await tokenRes.json();

    // ─── 쿠키에 토큰 저장 후 리다이렉트 ───
    // JWT가 길어서 query param 대신 쿠키 사용 (60초 후 자동 만료)
    loginPageUrl.searchParams.set("cognito_callback", "1");
    const response = NextResponse.redirect(loginPageUrl);

    response.cookies.set("cognito_id_token", tokens.id_token, {
      path: "/",
      maxAge: 60,
      httpOnly: false, // 클라이언트에서 읽어야 함
      sameSite: "lax",
    });

    response.cookies.set("cognito_access_token", tokens.access_token, {
      path: "/",
      maxAge: 60,
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    const errorMsg = encodeURIComponent(
      err.message || "카카오 Cognito 로그인 실패"
    );
    loginPageUrl.searchParams.set("cognito_error", errorMsg);
    return NextResponse.redirect(loginPageUrl);
  }
}
