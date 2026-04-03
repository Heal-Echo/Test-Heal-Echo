// src/app/api/public/auth/google/callback/route.ts
// =======================================================
// 🔵 구글 로그인 OAuth 콜백 핸들러 (하이브리드 방식)
// =======================================================
// 흐름:
// 1. 구글 authorization code → access token 교환
// 2. 구글 사용자 프로필 조회 (이메일 포함)
// 3. Cognito에 사용자 존재 여부 확인 → 없으면 생성
// 4. Cognito AdminInitiateAuth로 JWT 토큰 발급
// 5. 일회용 교환 코드로 프론트엔드에 전달 (쿠키 미사용 — 인앱 브라우저 호환)
//
// 핵심 설계:
// - Cognito Username = 구글 실제 이메일 (signInAliases: email 제약 충족)
// - 비밀번호 = googleId 기반 결정적 생성 (사용자 입력 불필요)
// - 한 구글 계정 = Cognito 사용자 1명

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { exchangeGoogleCode, getGoogleUserProfile } from "@/auth/google";
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

// ─── Cognito 설정 (카카오/네이버와 동일한 User Pool 사용) ───
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

// ─── 구글 사용자용 Cognito 비밀번호 ───
const SOCIAL_SALT = process.env.SOCIAL_PASSWORD_SALT || "";

function googlePassword(googleId: string): string {
  if (!SOCIAL_SALT) return googlePasswordLegacy(googleId);
  const hash = crypto.createHmac("sha256", SOCIAL_SALT)
    .update(`google:${googleId}`).digest("hex").substring(0, 20);
  return `Gg!${hash}_HE`;
}

function googlePasswordLegacy(googleId: string): string {
  return `Gg!${googleId}_HealEcho2025`;
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
// Username = 구글 실제 이메일 → email 속성과 자동 일치 (Cognito 제약 충족)
async function createCognitoUser(params: {
  email: string;
  googleId: string;
  nickname: string;
}): Promise<void> {
  const password = googlePassword(params.googleId);

  // 1) 사용자 생성
  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,           // 실제 구글 이메일 = Username
      TemporaryPassword: password,
      MessageAction: "SUPPRESS",        // 이메일 발송 안 함
      UserAttributes: [
        { Name: "email", Value: params.email },         // Username과 동일
        { Name: "email_verified", Value: "true" },
        { Name: "nickname", Value: params.nickname || "구글사용자" },
        { Name: "custom:signup_method", Value: "google" },
      ],
    })
  );

  // 2) 영구 비밀번호 설정 (NEW_PASSWORD_REQUIRED 상태 해제)
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      Password: password,
      Permanent: true,
    })
  );
}

// ─── Cognito 사용자 속성 업데이트 (닉네임, 프로필 사진) ───
async function updateCognitoUser(params: {
  email: string;
  nickname: string;
  profileImage: string | null;
}): Promise<void> {
  const attributes: { Name: string; Value: string }[] = [];
  if (params.nickname) {
    attributes.push({ Name: "nickname", Value: params.nickname });
  }
  if (params.profileImage) {
    attributes.push({ Name: "picture", Value: params.profileImage });
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

// ─── Cognito 토큰 발급 (AdminInitiateAuth) ───
async function getCognitoTokens(email: string, googleId: string) {
  const password = googlePassword(googleId);

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
      const legacyPw = googlePasswordLegacy(googleId);
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

// =======================================================
// GET 핸들러
// =======================================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // 실제 요청의 Host 헤더로 origin 구성 (dev server localhost 문제 대응)
  // Next.js dev server에서 request.url이 localhost를 반환하므로,
  // 모바일 기기(192.168.x.x 등)에서 접속 시 잘못된 리다이렉트 방지
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  // 사용자가 구글 로그인을 취소한 경우
  if (error) {
    return NextResponse.redirect(
      new URL("/public/login?google_error=cancelled", origin)
    );
  }

  // 인증 코드가 없는 경우
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/public/login?google_error=no_code", origin)
    );
  }

  // CSRF 방지: 서버에 저장된 state와 대조 검증
  const stateProvider = verifyOAuthState(state);
  if (stateProvider !== "google") {
    return NextResponse.redirect(
      new URL("/public/login?google_error=invalid_state", origin)
    );
  }

  try {
    // Step 1: 구글 authorization code → access token
    const tokenData = await exchangeGoogleCode(code);

    // Step 2: 구글 사용자 프로필 조회
    const profile = await getGoogleUserProfile(tokenData.access_token);
    const googleId = String(profile.id);
    const realEmail = profile.email;

    // 이메일 필수 확인
    if (!realEmail) {
      throw new Error("구글 계정에서 이메일을 받지 못했습니다. 구글 로그인 시 이메일 제공에 동의해주세요.");
    }

    // Step 3: Cognito 사용자 확인/생성 + 토큰 발급
    const exists = await cognitoUserExists(realEmail);
    let cognitoTokens;

    if (!exists) {
      // 첫 로그인 → Cognito 사용자 생성 (실제 이메일 = Username)
      await createCognitoUser({
        email: realEmail,
        googleId,
        nickname: profile.nickname || profile.name || "구글사용자",
      });
      console.log(`[구글→Cognito] 새 사용자 생성: ${realEmail} (googleId: ${googleId})`);

      // Step 4a: 신규 사용자 토큰 발급
      cognitoTokens = await getCognitoTokens(realEmail, googleId);
    } else {
      // 기존 사용자 → 구글 비밀번호로 인증 시도
      // 성공하면 구글로 가입한 사용자 → 재로그인 허용
      // 실패하면 다른 방법(이메일 등)으로 가입한 사용자 → 에러
      try {
        // Step 4b: 기존 사용자 토큰 발급 (인증 겸용)
        cognitoTokens = await getCognitoTokens(realEmail, googleId);
        if (!cognitoTokens?.IdToken) {
          throw new Error("token_fail");
        }
        // 인증 성공 → 닉네임/프로필 업데이트
        await updateCognitoUser({
          email: realEmail,
          nickname: profile.nickname || profile.name || "",
          profileImage: profile.profileImage,
        });
      } catch (authErr: any) {
        // NotAuthorizedException = 비밀번호 불일치 → 이메일로 가입된 사용자
        throw new Error("이메일로 이미 회원가입이 되었습니다.");
      }
    }

    if (!cognitoTokens?.IdToken || !cognitoTokens?.AccessToken) {
      throw new Error("Cognito 토큰 발급 실패");
    }

    // Step 5: 프론트엔드에 Cognito 토큰 전달 (일회용 교환 코드)
    // 쿠키 대신 서버 메모리에 토큰 저장 → 교환 코드를 URL 파라미터로 전달
    // 인앱 브라우저에서도 안전하게 작동
    const authCode = createAuthCode(
      cognitoTokens.IdToken,
      cognitoTokens.AccessToken,
      "google"
    );

    const loginPageUrl = new URL("/public/login", origin);
    loginPageUrl.searchParams.set("auth_code", authCode);
    loginPageUrl.searchParams.set("auth_provider", "google");

    return NextResponse.redirect(loginPageUrl);
  } catch (err: any) {
    console.error("[구글→Cognito 에러]", err.message || err);

    return NextResponse.redirect(
      new URL(
        `/public/login?google_error=${encodeURIComponent(
          err.message || "구글 로그인 처리 중 오류가 발생했습니다."
        )}`,
        origin
      )
    );
  }
}
