import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getKakaoLoginUrl,
  saveCognitoKakaoSession,
} from "@/auth/kakao";
import {
  getNaverLoginUrl,
  saveCognitoNaverSession,
} from "@/auth/naver";
import {
  getGoogleLoginUrl,
  saveCognitoGoogleSession,
} from "@/auth/google";
import {
  getAppleLoginUrl,
  saveCognitoAppleSession,
} from "@/auth/apple";

import { setRaw } from "@/lib/storage";
import { AUTH_API } from "@/config/constants";
import { recordLogin, sendPendingConsent, getPostLoginRedirect, getErrorMessage } from "./utils";

interface TokenExchangeResponse {
  idToken: string;
  accessToken: string;
}

interface OAuthStateResponse {
  state: string;
}

interface UseSocialLoginDeps {
  hasTermsConsent: boolean;
  showConsentToast: () => void;
  showBanner: (message: string, type: "success" | "error") => void;
}

export function useSocialLogin({
  hasTermsConsent,
  showConsentToast,
  showBanner,
}: UseSocialLoginDeps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSocialCallbackLoading, setIsSocialCallbackLoading] = useState(false);

  // 소셜 로그인 통합 콜백 처리 (교환 코드 방식)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const authCode = searchParams.get("auth_code");
    const authProvider = searchParams.get("auth_provider");
    if (!authCode || !authProvider) return;

    setIsSocialCallbackLoading(true);
    (async () => {
      try {
        const res = await fetch(AUTH_API.EXCHANGE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: authCode }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "토큰 교환에 실패했습니다.");
        }
        const { idToken, accessToken }: TokenExchangeResponse = await res.json();

        switch (authProvider) {
          case "kakao": saveCognitoKakaoSession(idToken, accessToken); break;
          case "naver": saveCognitoNaverSession(idToken, accessToken); break;
          case "google": saveCognitoGoogleSession(idToken, accessToken); break;
          case "apple": saveCognitoAppleSession(idToken, accessToken); break;
          default: throw new Error(`알 수 없는 로그인 제공자: ${authProvider}`);
        }

        recordLogin(idToken);
        sendPendingConsent(idToken);
        import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
        router.replace(getPostLoginRedirect());
      } catch (err: unknown) {
        showBanner(getErrorMessage(err) || "소셜 로그인 처리 중 오류가 발생했습니다.", "error");
        window.history.replaceState({}, "", "/public/login");
      } finally {
        setIsSocialCallbackLoading(false);
      }
    })();
  }, [searchParams, router, showBanner]);

  // 서버에서 OAuth state를 받아오는 헬퍼
  async function fetchOAuthState(provider: string): Promise<string> {
    const res = await fetch(AUTH_API.STATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) throw new Error("OAuth state 생성 실패");
    const { state }: OAuthStateResponse = await res.json();
    return state;
  }

  function saveSocialConsent() {
    setRaw("pending_consent", JSON.stringify({
      termsConsent: true,
      termsConsentAt: new Date().toISOString(),
    }));
  }

  const socialLoginUrlMap: Record<string, (state: string) => string> = {
    kakao: getKakaoLoginUrl,
    naver: getNaverLoginUrl,
    google: getGoogleLoginUrl,
    apple: getAppleLoginUrl,
  };

  const socialProviderLabel: Record<string, string> = {
    kakao: "카카오",
    naver: "네이버",
    google: "구글",
    apple: "애플",
  };

  const handleSocialLogin = useCallback(async (provider: string) => {
    if (!hasTermsConsent) {
      showConsentToast();
      return;
    }
    try {
      saveSocialConsent();
      const state = await fetchOAuthState(provider);
      const getLoginUrl = socialLoginUrlMap[provider];
      if (!getLoginUrl) throw new Error(`Unknown provider: ${provider}`);
      window.location.href = getLoginUrl(state);
    } catch {
      const label = socialProviderLabel[provider] || provider;
      showBanner(`${label} 로그인 준비 중 오류가 발생했습니다.`, "error");
    }
  }, [hasTermsConsent, showConsentToast, showBanner]);

  const handleKakaoLogin = useCallback(() => handleSocialLogin("kakao"), [handleSocialLogin]);
  const handleNaverLogin = useCallback(() => handleSocialLogin("naver"), [handleSocialLogin]);
  const handleGoogleLogin = useCallback(() => handleSocialLogin("google"), [handleSocialLogin]);
  const handleAppleLogin = useCallback(() => handleSocialLogin("apple"), [handleSocialLogin]);

  // 소셜 로그인 에러 파라미터 처리
  useEffect(() => {
    if (typeof window === "undefined") return;
    const providerErrors: { param: string; label: string }[] = [
      { param: "kakao_error", label: "카카오" },
      { param: "naver_error", label: "네이버" },
      { param: "google_error", label: "구글" },
      { param: "apple_error", label: "애플" },
    ];
    const knownErrors: Record<string, (label: string) => string> = {
      cancelled: (label) => `${label} 로그인이 취소되었습���다.`,
      access_denied: (label) => `${label} 로그인 권한이 거부되었���니다.`,
      server_error: (label) => `${label} 로그인 중 서버 오류가 발생했습니다.`,
      token_error: (label) => `${label} 인증 토큰 처리 중 오류가 발생했���니다.`,
    };
    const fallbackError = (label: string) => `${label} 로그인 중 오류가 발생했습니다.`;

    for (const { param, label } of providerErrors) {
      const errValue = searchParams.get(param);
      if (errValue) {
        const getMsg = knownErrors[errValue] || fallbackError;
        showBanner(getMsg(label), "error");
        window.history.replaceState({}, "", "/public/login");
        break;
      }
    }
  }, [searchParams, showBanner]);

  return {
    isSocialCallbackLoading,
    handleKakaoLogin,
    handleNaverLogin,
    handleGoogleLogin,
    handleAppleLogin,
  };
}
