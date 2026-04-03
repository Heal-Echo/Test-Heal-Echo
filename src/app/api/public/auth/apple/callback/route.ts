// src/app/api/public/auth/apple/callback/route.ts
// =======================================================
// 🍎 애플 로그인 OAuth 콜백 핸들러 (하이브리드 방식)
// =======================================================
// 흐름:
// 1. Apple POST callback → authorization code 수신
// 2. Apple client_secret (JWT) 생성
// 3. authorization code → id_token 교환
// 4. id_token에서 사용자 정보 추출 (sub, email)
// 5. Cognito에 사용자 존재 여부 확인 → 없으면 생성
// 6. Cognito AdminInitiateAuth로 JWT 토큰 발급
// 7. 일회용 교환 코드로 프론트엔드에 전달
//
// 핵심 설계:
// - Apple은 POST로 콜백 (response_mode=form_post)
// - client_secret = ES256 JWT (Team ID, Key ID, Private Key로 서명)
// - 사용자 이름/이메일은 최초 로그인 시에만 제공됨
// - Cognito Username = 애플 이메일
// - 비밀번호 = Apple sub 기반 결정적 생성

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { createAuthCode } from "@/app/api/public/auth/exchange/store";
import { verifyOAuthState } from "@/app/api/public/auth/state/store";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// ─── Apple 설정 ───
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || "";
const APPLE_SERVICE_ID = process.env.NEXT_PUBLIC_APPLE_SERVICE_ID || "";
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || "";
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || "";

// ─── Cognito 설정 (카카오/네이버/구글과 동일한 User Pool 사용) ───
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-northeast-2";
const USER_POOL_ID =
  process.env.COGNITO_ADMIN_USER_POOL_ID ||
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
  "";
const CLIENT_ID =
  process.env.COGNITO_ADMIN_CLIENT_ID ||
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ||
  "";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// ─── Base64url 인코딩 ───
function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Apple client_secret JWT 생성 (ES256) ───
function generateAppleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "ES256",
    kid: APPLE_KEY_ID,
  };

  const payload = {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 15777000, // 약 6개월
    aud: "https://appleid.apple.com",
    sub: APPLE_SERVICE_ID,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // ES256 서명 (Node.js crypto)
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  sign.end();

  // DER 형식 서명 → r, s 추출 → 64바이트 고정 길이
  const derSig = sign.sign({ key: APPLE_PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  const signatureB64 = base64url(derSig);

  return `${signingInput}.${signatureB64}`;
}

// ─── Apple id_token에서 payload 추출 (서명 검증 생략 — 서버간 통신이므로) ───
function decodeAppleIdToken(idToken: string): {
  sub: string;
  email?: string;
  email_verified?: string;
} {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple id_token");
  const payload = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
  );
  return payload;
}

// ─── 애플 사용자용 Cognito 비밀번호 ───
const SOCIAL_SALT = process.env.SOCIAL_PASSWORD_SALT || "";

function applePassword(appleSub: string): string {
  if (!SOCIAL_SALT) return applePasswordLegacy(appleSub);
  const hash = crypto.createHmac("sha256", SOCIAL_SALT)
    .update(`apple:${appleSub}`).digest("hex").substring(0, 20);
  return `Ap!${hash}_HE`;
}

function applePasswordLegacy(appleSub: string): string {
  return `Ap!${appleSub.substring(0, 20)}_HealEcho2025`;
}

// ─── Cognito 사용자 존재 여부 확인 ───
async function cognitoUserExists(email: string): Promise<boolean> {
  try {
    await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    );
    return true;
  } catch (err: any) {
    if (err.name === "UserNotFoundException") return false;
    throw err;
  }
}

// ─── Cognito 사용자 생성 ───
async function createCognitoUser(params: {
  email: string;
  appleSub: string;
  nickname: string;
}): Promise<void> {
  const password = applePassword(params.appleSub);

  // 1) 사용자 생성
  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      TemporaryPassword: password,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: params.email },
        { Name: "email_verified", Value: "true" },
        { Name: "nickname", Value: params.nickname || "애플사용자" },
        { Name: "custom:signup_method", Value: "apple" },
      ],
    })
  );

  // 2) 영구 비밀번호 설정
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      Password: password,
      Permanent: true,
    })
  );
}

// ─── Cognito 사용자 속성 업데이트 ───
async function updateCognitoUser(params: {
  email: string;
  nickname: string;
}): Promise<void> {
  const attributes: { Name: string; Value: string }[] = [];
  if (params.nickname) {
    attributes.push({ Name: "nickname", Value: params.nickname });
  }
  if (attributes.length === 0) return;

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      UserAttributes: attributes,
    })
  );
}

// ─── Cognito 토큰 발급 ───
async function getCognitoTokens(email: string, appleSub: string) {
  const password = applePassword(appleSub);

  try {
    const result = await cognitoClient.send(
      new AdminInitiateAuthCommand({
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );
    return result.AuthenticationResult;
  } catch (err: any) {
    if (SOCIAL_SALT && err.name === "NotAuthorizedException") {
      const legacyPw = applePasswordLegacy(appleSub);
      const result = await cognitoClient.send(
        new AdminInitiateAuthCommand({
          UserPoolId: USER_POOL_ID,
          ClientId: CLIENT_ID,
          AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
          AuthParameters: {
            USERNAME: email,
            PASSWORD: legacyPw,
          },
        })
      );
      if (result.AuthenticationResult?.IdToken) {
        await cognitoClient.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: password,
            Permanent: true,
          })
        );
      }
      return result.AuthenticationResult;
    }
    throw err;
  }
}

// ─── ngrok 등 프록시 환경에서 올바른 기본 URL 추출 ───
function getBaseUrl(request: NextRequest): string {
  // x-forwarded-host 헤더가 있으면 ngrok 등 프록시 환경
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  // APPLE_REDIRECT_URI에서 기본 URL 추출 (fallback)
  if (APPLE_REDIRECT_URI) {
    const url = new URL(APPLE_REDIRECT_URI);
    return url.origin;
  }
  return new URL(request.url).origin;
}

// =======================================================
// POST 핸들러 (Apple은 form_post 방식으로 POST 콜백)
// =======================================================
export async function POST(request: NextRequest) {
  try {
    const baseUrl = getBaseUrl(request);
    const formData = await request.formData();
    const code = formData.get("code") as string | null;
    const state = formData.get("state") as string | null;
    const userStr = formData.get("user") as string | null;
    const error = formData.get("error") as string | null;

    // 사용자가 애플 로그인을 취소한 경우
    if (error) {
      return NextResponse.redirect(
        new URL("/public/login?apple_error=cancelled", baseUrl)
      );
    }

    // 인증 코드가 없는 경우
    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/public/login?apple_error=no_code", baseUrl)
      );
    }

    // CSRF 방지: 서버에 저장된 state와 대조 검증
    const stateProvider = verifyOAuthState(state);
    if (stateProvider !== "apple") {
      return NextResponse.redirect(
        new URL("/public/login?apple_error=invalid_state", baseUrl)
      );
    }

    // Step 1: Apple client_secret 생성
    const clientSecret = generateAppleClientSecret();

    // Step 2: authorization code → token 교환
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: APPLE_SERVICE_ID,
        client_secret: clientSecret,
        redirect_uri: APPLE_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      throw new Error(errData.error || "애플 토큰 교환 실패");
    }

    const tokenData = await tokenRes.json();

    // Step 3: id_token에서 사용자 정보 추출
    const applePayload = decodeAppleIdToken(tokenData.id_token);
    const appleSub = applePayload.sub;
    const appleEmail = applePayload.email;

    // 이메일 필수 확인
    if (!appleEmail) {
      throw new Error("애플 계정에서 이메일을 받지 못했습니다.");
    }

    // Apple은 최초 로그인 시에만 user 정보(이름)를 제공
    let userName = "애플사용자";
    if (userStr) {
      try {
        const userInfo = JSON.parse(userStr);
        const firstName = userInfo.name?.firstName || "";
        const lastName = userInfo.name?.lastName || "";
        userName = `${lastName}${firstName}`.trim() || "애플사용자";
      } catch {
        // user 파싱 실패 시 기본값 사용
      }
    }

    // Step 4: Cognito 사용자 확인/생성 + 토큰 발급
    const exists = await cognitoUserExists(appleEmail);
    let cognitoTokens;

    if (!exists) {
      // 첫 로그인 → Cognito 사용자 생성
      await createCognitoUser({
        email: appleEmail,
        appleSub,
        nickname: userName,
      });
      console.log(`[애플→Cognito] 새 사용자 생성: ${appleEmail} (sub: ${appleSub})`);

      cognitoTokens = await getCognitoTokens(appleEmail, appleSub);
    } else {
      // 기존 사용자 → 애플 비밀번호로 인증 시도
      try {
        cognitoTokens = await getCognitoTokens(appleEmail, appleSub);
        if (!cognitoTokens?.IdToken) {
          throw new Error("token_fail");
        }
        // 인증 성공 → 닉네임 업데이트 (최초 로그인 시 이름 제공된 경우만)
        if (userStr && userName !== "애플사용자") {
          await updateCognitoUser({
            email: appleEmail,
            nickname: userName,
          });
        }
      } catch (authErr: any) {
        // NotAuthorizedException = 비밀번호 불일치 → 다른 방법으로 가입된 사용자
        throw new Error("이메일로 이미 회원가입이 되었습니다.");
      }
    }

    if (!cognitoTokens?.IdToken || !cognitoTokens?.AccessToken) {
      throw new Error("Cognito 토큰 발급 실패");
    }

    // Step 5: 일회용 교환 코드로 프론트엔드에 전달
    const authCode = createAuthCode(
      cognitoTokens.IdToken,
      cognitoTokens.AccessToken,
      "apple"
    );

    const loginPageUrl = new URL("/public/login", baseUrl);
    loginPageUrl.searchParams.set("auth_code", authCode);
    loginPageUrl.searchParams.set("auth_provider", "apple");

    return NextResponse.redirect(loginPageUrl);
  } catch (err: any) {
    console.error("[애플→Cognito 에러]", err.message || err);

    const errorBaseUrl = getBaseUrl(request);
    return NextResponse.redirect(
      new URL(
        `/public/login?apple_error=${encodeURIComponent(
          err.message || "애플 로그인 처리 중 오류가 발생했습니다."
        )}`,
        errorBaseUrl
      )
    );
  }
}
