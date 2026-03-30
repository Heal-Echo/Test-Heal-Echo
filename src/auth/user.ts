// src/auth/user.ts
// =======================================================
// 🔐 일반 사용자용 Cognito Custom UI 인증 모듈 (CSR 전용)
// =======================================================

import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import * as storage from "@/lib/storage";
import { cognitoStorageAdapter } from "@/lib/storage";
import { AUTH_KEYS } from "./constants";

// =======================================================
// Cognito Pool 설정 (이미 값이 있다면 그대로 유지)
// =======================================================
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-northeast-2";
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const APP_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";

// 로그인 성공 후 이동시키고 싶은 경로
const REDIRECT_AFTER_LOGIN = "/home";

// =======================================================
// Cognito UserPool (CSR에서만 사용)
// ✅ 커스텀 Storage 어댑터를 통해 추상화 레이어 경유
//    — SDK 내부 localStorage 직접 접근 제거
//    — 향후 앱 전환 시 storage.ts만 교체하면 SDK도 자동 대응
// =======================================================
export const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: APP_CLIENT_ID,
  Storage: cognitoStorageAdapter,
});

// 인증 키 (constants.ts에서 중앙 관리)
const KEY_ID_TOKEN = AUTH_KEYS.ID_TOKEN;
const KEY_ACCESS_TOKEN = AUTH_KEYS.ACCESS_TOKEN;
const KEY_USER_EMAIL = AUTH_KEYS.USER_EMAIL;

// SSR 방지
function isBrowser() {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 회원가입
// =======================================================
export function userSignup(
  email: string,
  password: string,
  givenName: string,
  familyName: string
) {
  return new Promise((resolve, reject) => {
    const attrList = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({ Name: "given_name", Value: givenName }),
      new CognitoUserAttribute({ Name: "family_name", Value: familyName }),
      new CognitoUserAttribute({ Name: "custom:signup_method", Value: "email" }),
    ];

    userPool.signUp(email, password, attrList, [], function (err, result) {
      if (err) return reject(err);

      storage.setRaw(KEY_USER_EMAIL, email);

      resolve(result);
    });
  });
}

// =======================================================
// 2) 이메일 인증 확인
// =======================================================
export function userConfirmSignup(email: string, code: string) {
  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, function (err, result) {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// =======================================================
// 3) 로그인
// =======================================================
export function userLogin(email: string, password: string) {
  return new Promise<{ idToken: string; accessToken: string; redirect: string }>(
    (resolve, reject) => {
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();

          storage.setRaw(KEY_ID_TOKEN, idToken);
          storage.setRaw(KEY_ACCESS_TOKEN, accessToken);
          storage.setRaw(KEY_USER_EMAIL, email);

          resolve({
            idToken,
            accessToken,
            redirect: REDIRECT_AFTER_LOGIN,
          });
        },

        onFailure(err) {
          reject(err);
        },

        newPasswordRequired() {
          reject({ type: "NEW_PASSWORD_REQUIRED" });
        },
      });
    }
  );
}

// =======================================================
// 4) 비밀번호 재설정 - Step1
// =======================================================
export function userForgotPassword(email: string) {
  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess() {
        storage.setRaw(KEY_USER_EMAIL, email);
        resolve(true);
      },
      onFailure(err) {
        reject(err);
      },
      inputVerificationCode() {
        storage.setRaw(KEY_USER_EMAIL, email);
        resolve(true);
      },
    });
  });
}

// =======================================================
// 5) 비밀번호 재설정 - Step2
// =======================================================
export function userConfirmPassword(
  email: string,
  code: string,
  newPassword: string
) {
  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess() {
        resolve(true);
      },
      onFailure(err) {
        reject(err);
      },
    });
  });
}

// =======================================================
// 6) 이름 변경 (Cognito 속성 업데이트 + 토큰 갱신)
// =======================================================
export function updateUserName(newName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error("브라우저 환경이 아닙니다."));

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return reject(new Error("로그인 세션이 없습니다. 다시 로그인해 주세요."));
    }

    // 세션 복원
    cognitoUser.getSession(
      (err: Error | null, session: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          return reject(new Error("세션이 만료되었습니다. 다시 로그인해 주세요."));
        }

        // given_name에 전체 이름 저장 (한국 이름 단일 필드)
        const attributes = [
          new CognitoUserAttribute({ Name: "given_name", Value: newName }),
          new CognitoUserAttribute({ Name: "family_name", Value: "" }),
        ];

        cognitoUser.updateAttributes(attributes, (err, result) => {
          if (err) return reject(err);

          // 토큰 갱신 — 새 ID 토큰에 변경된 이름 반영
          cognitoUser.refreshSession(
            session.getRefreshToken(),
            (refreshErr: Error | null, newSession: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
              if (refreshErr || !newSession) {
                // 속성은 업데이트됐지만 토큰 갱신 실패 → 재로그인 필요
                console.warn("토큰 갱신 실패, 다음 로그인 시 반영됩니다.", refreshErr);
                resolve(true);
                return;
              }

              // 갱신된 토큰을 storage에 저장
              storage.setRaw(KEY_ID_TOKEN, newSession.getIdToken().getJwtToken());
              storage.setRaw(KEY_ACCESS_TOKEN, newSession.getAccessToken().getJwtToken());
              resolve(true);
            }
          );
        });
      }
    );
  });
}

// =======================================================
// 7) 이메일 변경 Step1 — 새 이메일 속성 업데이트 (인증 코드 자동 발송)
// =======================================================
export function updateUserEmail(newEmail: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error("브라우저 환경이 아닙니다."));

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return reject(new Error("로그인 세션이 없습니다. 다시 로그인해 주세요."));
    }

    cognitoUser.getSession(
      (err: Error | null, session: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          return reject(new Error("세션이 만료되었습니다. 다시 로그인해 주세요."));
        }

        const attributes = [
          new CognitoUserAttribute({ Name: "email", Value: newEmail }),
        ];

        cognitoUser.updateAttributes(attributes, (err, result) => {
          if (err) return reject(err);
          // Cognito가 새 이메일로 인증 코드를 자동 발송함
          resolve(true);
        });
      }
    );
  });
}

// =======================================================
// 8) 이메일 변경 Step2 — 인증 코드 확인 + 토큰 갱신
// =======================================================
export function verifyUserEmail(code: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error("브라우저 환경이 아닙니다."));

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return reject(new Error("로그인 세션이 없습니다. 다시 로그인해 주세요."));
    }

    cognitoUser.getSession(
      (err: Error | null, session: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          return reject(new Error("세션이 만료되었습니다. 다시 로그인해 주세요."));
        }

        cognitoUser.verifyAttribute("email", code, {
          onSuccess() {
            // 토큰 갱신 — 새 이메일이 반영된 ID 토큰 발급
            cognitoUser.refreshSession(
              session.getRefreshToken(),
              (refreshErr: Error | null, newSession: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
                if (refreshErr || !newSession) {
                  console.warn("토큰 갱신 실패, 다음 로그인 시 반영됩니다.", refreshErr);
                  resolve(true);
                  return;
                }

                storage.setRaw(KEY_ID_TOKEN, newSession.getIdToken().getJwtToken());
                storage.setRaw(KEY_ACCESS_TOKEN, newSession.getAccessToken().getJwtToken());

                // storage의 이메일도 업데이트
                try {
                  const payload = newSession.getIdToken().getJwtToken().split(".")[1];
                  const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
                  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
                  const decoded = JSON.parse(new TextDecoder().decode(bytes));
                  if (decoded.email) {
                    storage.setRaw(KEY_USER_EMAIL, decoded.email);
                  }
                } catch {}

                resolve(true);
              }
            );
          },
          onFailure(err) {
            reject(err);
          },
        });
      }
    );
  });
}

// =======================================================
// 9) 비밀번호 변경 (현재 비밀번호 검증 후 변경)
// =======================================================
export function changeUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) return reject(new Error("브라우저 환경이 아닙니다."));

    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return reject(new Error("로그인 세션이 없습니다. 다시 로그인해 주세요."));
    }

    cognitoUser.getSession(
      (err: Error | null, session: import("amazon-cognito-identity-js").CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          return reject(new Error("세션이 만료되었습니다. 다시 로그인해 주세요."));
        }

        cognitoUser.changePassword(currentPassword, newPassword, (err, result) => {
          if (err) return reject(err);
          resolve(true);
        });
      }
    );
  });
}

// =======================================================
// 8) 로그아웃
// =======================================================
export function userLogout() {
  if (isBrowser()) {
    // 1) 사용자 데이터 일괄 삭제 (storage 레이어 — 계정 간 오염 방지)
    //    clearUserData()는 userId-scoped 키 + 기존 키 + 동적 키 모두 처리
    storage.clearUserData();

    // 2) 인증 토큰 제거
    storage.removeRaw(KEY_ID_TOKEN);
    storage.removeRaw(KEY_ACCESS_TOKEN);

    // 3) 소셜 로그인 세션 정리
    storage.removeRaw(AUTH_KEYS.KAKAO_ID);
    storage.removeRaw(AUTH_KEYS.KAKAO_NICKNAME);
    storage.removeRaw(AUTH_KEYS.KAKAO_PROFILE_IMAGE);
    storage.removeRaw(AUTH_KEYS.LOGIN_METHOD);

    // 4) Cognito SDK 세션 정리
    const lastEmail = storage.getRaw(KEY_USER_EMAIL) || "";
    try {
      const user = userPool.getCurrentUser();
      if (user) user.signOut();
      else if (lastEmail) {
        const tmp = new CognitoUser({ Username: lastEmail, Pool: userPool });
        tmp.signOut();
      }
    } catch (e) {}

    // 5) sessionStorage 정리 (마지막에 — handleLogout에서 이후 설정 가능)
    storage.clearSession();
  }
}

// =======================================================
// 9) 로그인 여부 체크
// =======================================================
export function isUserLoggedIn() {
  if (!isBrowser()) return false;
  const token = storage.getRaw(KEY_ID_TOKEN);
  return !!token;
}

// =======================================================
// 10) 사용자 정보 반환
// =======================================================
export function getUserInfo() {
  if (!isBrowser()) return null;
  return {
    idToken: storage.getRaw(KEY_ID_TOKEN),
    accessToken: storage.getRaw(KEY_ACCESS_TOKEN),
    email: storage.getRaw(KEY_USER_EMAIL),
  };
}

// =======================================================
// 11) 사용자 이름 반환 (JWT ID Token에서 추출)
// =======================================================
export function getUserName(): string | null {
  if (!isBrowser()) return null;

  // 카카오 로그인 사용자인 경우 닉네임 반환
  const loginMethod = storage.getRaw(AUTH_KEYS.LOGIN_METHOD);
  if (loginMethod === "kakao") {
    return storage.getRaw(AUTH_KEYS.KAKAO_NICKNAME) || "카카오 사용자";
  }

  const idToken = storage.getRaw(KEY_ID_TOKEN);
  if (!idToken) return null;

  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;

    // atob → UTF-8 디코딩 (한글 등 멀티바이트 문자 처리)
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    const decoded = JSON.parse(jsonStr);

    // Cognito: given_name + family_name 또는 name 또는 email
    const givenName = decoded.given_name || "";
    const familyName = decoded.family_name || "";

    if (givenName || familyName) {
      return `${familyName}${givenName}`.trim();
    }

    if (decoded.name) return decoded.name;

    return decoded.email || null;
  } catch {
    return null;
  }
}

// =======================================================
// 12) 유효한 토큰이 보장된 사용자 정보 반환 (비동기)
// =======================================================
export async function getValidUserInfo(): Promise<{
  idToken: string;
  accessToken: string;
  email: string | null;
} | null> {
  const { ensureValidToken } = await import("./tokenManager");
  const tokens = await ensureValidToken();
  if (!tokens) return null;

  return {
    ...tokens,
    email: storage.getRaw(KEY_USER_EMAIL),
  };
}
