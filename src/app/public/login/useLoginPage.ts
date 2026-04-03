import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  userSignup,
  userConfirmSignup,
  userLogin,
  userForgotPassword,
  userConfirmPassword,
} from "@/auth/user";

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

import { getSession, removeSession, setRaw } from "@/lib/storage";
import { AUTH_API } from "@/config/constants";
import { recordLogin, sendPendingConsent, getPostLoginRedirect } from "./utils";

export type View =
  | "login"
  | "signup"
  | "confirm"
  | "forgotStep1"
  | "forgotStep2";

type BannerType = "success" | "error";

export interface BannerState {
  message: string;
  type: BannerType;
}

export function useLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -----------------------------
  // 🔙 마이페이지에서 로그아웃 후 들어온 경우
  //    → 로그인 페이지에서 뒤로가기 무시
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const from = getSession("logoutFrom");

    if (from !== "mypage") {
      return;
    }

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      removeSession("logoutFrom");
    };
  }, []);

  // 화면 상태
  const [view, setView] = useState<View>("login");
  const [viewKey, setViewKey] = useState(0);

  // 회원가입 정보
  const [signupEmail, setSignupEmail] = useState("");
  const [signupFamilyName, setSignupFamilyName] = useState("");
  const [signupGivenName, setSignupGivenName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPwConfirm, setSignupPwConfirm] = useState("");
  const [signupPwConfirmTouched, setSignupPwConfirmTouched] = useState(false);

  // 약관 동의
  const [termsConsent, setTermsConsent] = useState(false);

  // 동의 안내 말풍선
  const [consentToastKey, setConsentToastKey] = useState(0);
  const consentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showConsentToast = useCallback(() => {
    if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    setConsentToastKey((k) => k + 1);
    consentTimerRef.current = setTimeout(() => setConsentToastKey(0), 3100);
  }, []);

  // 인증 코드 확인
  const [verifyCode, setVerifyCode] = useState("");

  // 로그인 정보
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 비밀번호 재설정
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 로딩/에러 상태
  const [loading, setLoading] = useState(false);
  const [socialCallbackLoading, setSocialCallbackLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotSocialInfo, setForgotSocialInfo] = useState<{
    message: string;
    method: string | null;
  } | null>(null);

  // 비밀번호 보기/숨기기 토글
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPwConfirm, setShowSignupPwConfirm] = useState(false);
  const [signupPwFocused, setSignupPwFocused] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // ============================================================
  // 인라인 배너 상태 (alert 대체)
  // ============================================================
  const [banner, setBanner] = useState<BannerState | null>(null);

  const showBanner = useCallback((message: string, type: BannerType) => {
    setBanner({ message, type });
  }, []);

  // 배너 자동 사라짐: 성공 배너만 5초 후 사라짐, 에러 배너는 유지
  useEffect(() => {
    if (!banner) return;
    if (banner.type === "success") {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // -----------------------------
  // 🔄 소셜 로그인 통합 콜백 처리 (교환 코드 방식)
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const authCode = searchParams.get("auth_code");
    const authProvider = searchParams.get("auth_provider");

    if (!authCode || !authProvider) return;

    setSocialCallbackLoading(true);
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

        const { idToken, accessToken } = await res.json();

        switch (authProvider) {
          case "kakao":
            saveCognitoKakaoSession(idToken, accessToken);
            break;
          case "naver":
            saveCognitoNaverSession(idToken, accessToken);
            break;
          case "google":
            saveCognitoGoogleSession(idToken, accessToken);
            break;
          case "apple":
            saveCognitoAppleSession(idToken, accessToken);
            break;
          default:
            throw new Error(`알 수 없는 로그인 제공자: ${authProvider}`);
        }

        recordLogin(idToken);
        sendPendingConsent(idToken);
        import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
        router.replace(getPostLoginRedirect());
      } catch (err: any) {
        showBanner(err.message || "소셜 로그인 처리 중 오류가 발생했습니다.", "error");
        window.history.replaceState({}, "", "/public/login");
      } finally {
        setSocialCallbackLoading(false);
      }
    })();
  }, [searchParams, router, showBanner]);

  // -----------------------------
  // 서버에서 OAuth state를 받아오는 헬퍼
  // -----------------------------
  async function fetchOAuthState(provider: string): Promise<string> {
    const res = await fetch(AUTH_API.STATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) throw new Error("OAuth state 생성 실패");
    const { state } = await res.json();
    return state;
  }

  // -----------------------------
  // 소셜 로그인 통합 핸들러
  // -----------------------------
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
    if (!termsConsent) {
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
  }, [termsConsent]);

  const handleKakaoLogin = useCallback(() => handleSocialLogin("kakao"), [handleSocialLogin]);
  const handleNaverLogin = useCallback(() => handleSocialLogin("naver"), [handleSocialLogin]);
  const handleGoogleLogin = useCallback(() => handleSocialLogin("google"), [handleSocialLogin]);
  const handleAppleLogin = useCallback(() => handleSocialLogin("apple"), [handleSocialLogin]);

  // -----------------------------
  // 소셜 로그인 에러 파라미터 처리
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const providerErrors: { param: string; label: string }[] = [
      { param: "kakao_error", label: "카카오" },
      { param: "naver_error", label: "네이버" },
      { param: "google_error", label: "구글" },
      { param: "apple_error", label: "애플" },
    ];

    const knownErrors: Record<string, (label: string) => string> = {
      cancelled: (label) => `${label} 로그인이 취소되었습니다.`,
      access_denied: (label) => `${label} 로그인 권한이 거부되었습니다.`,
      server_error: (label) => `${label} 로그인 중 서버 오류가 발생했습니다.`,
      token_error: (label) => `${label} 인증 토큰 처리 중 오류가 발생했습니다.`,
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

  const switchView = (v: View) => {
    setBanner(null);
    setLoading(false);
    setLoginError("");
    setForgotSocialInfo(null);

    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupFamilyName("");
    setSignupGivenName("");
    setVerifyCode("");
    setForgotEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");

    setShowLoginPw(false);
    setShowSignupPw(false);
    setSignupPwConfirm("");
    setSignupPwConfirmTouched(false);
    setShowResetPw(false);
    setShowConfirmPw(false);

    setViewKey((k) => k + 1);
    setView(v);
  };

  // ============================================================
  // 비밀번호 유효성 검사 (회원가입 + 비밀번호 재설정 공용)
  // ============================================================
  function getPwRules(pw: string) {
    return [
      { label: "8자 이상", pass: pw.length >= 8 },
      { label: "숫자 포함", pass: /\d/.test(pw) },
      { label: "영문 대문자 포함", pass: /[A-Z]/.test(pw) },
      { label: "특수문자 포함", pass: /[^A-Za-z0-9]/.test(pw) },
    ];
  }

  const pwRules = useMemo(() => getPwRules(signupPassword), [signupPassword]);
  const allPwRulesPassed = pwRules.every((r) => r.pass);

  const resetPwRules = useMemo(() => getPwRules(newPassword), [newPassword]);
  const allResetPwRulesPassed = resetPwRules.every((r) => r.pass);

  // 비밀번호 규칙 모두 충족 시 0.5초 후 숨김
  const [pwRulesHidden, setPwRulesHidden] = useState(false);
  const [pwRulesFading, setPwRulesFading] = useState(false);
  const pwRulesTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (allPwRulesPassed && signupPassword.length > 0) {
      pwRulesTimerRef.current = setTimeout(() => {
        setPwRulesFading(true);
        setTimeout(() => {
          setPwRulesHidden(true);
          setPwRulesFading(false);
        }, 300);
      }, 500);
    } else {
      if (pwRulesTimerRef.current) clearTimeout(pwRulesTimerRef.current);
      setPwRulesHidden(false);
      setPwRulesFading(false);
    }
    return () => {
      if (pwRulesTimerRef.current) clearTimeout(pwRulesTimerRef.current);
    };
  }, [allPwRulesPassed, signupPassword.length]);

  // ============================================================
  // 회원가입
  // ============================================================
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!allPwRulesPassed) {
      showBanner("비밀번호 조건을 모두 충족해주세요.", "error");
      return;
    }
    if (signupPassword !== signupPwConfirm) {
      setSignupPwConfirmTouched(true);
      return;
    }
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    setLoading(true);
    setBanner(null);

    const trimmedGivenName = signupGivenName.trim();
    const trimmedFamilyName = signupFamilyName.trim();

    try {
      await userSignup(
        signupEmail,
        signupPassword,
        trimmedGivenName,
        trimmedFamilyName
      );

      setRaw("pending_consent", JSON.stringify({
        termsConsent: true,
        termsConsentAt: new Date().toISOString(),
      }));

      showBanner("회원가입 성공! 이메일의 인증코드를 입력해주세요.", "success");
      switchView("confirm");
    } catch (err: any) {
      showBanner(err.message || "회원가입 실패", "error");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 회원가입 이메일 인증
  // ============================================================
  async function handleConfirmSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBanner(null);

    try {
      await userConfirmSignup(signupEmail, verifyCode);
      showBanner("인증 완료! 로그인해주세요.", "success");
      switchView("login");
    } catch (err: any) {
      showBanner(err.message || "인증 실패", "error");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 로그인
  // ============================================================
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    setBanner(null);

    try {
      const result: any = await userLogin(loginEmail, loginPassword);
      recordLogin(result.idToken);
      sendPendingConsent(result.idToken);
      import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
      router.replace(getPostLoginRedirect());
    } catch (err: any) {
      setLoginError("이메일 주소 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 비밀번호 재설정 Step 1
  // ============================================================
  async function handleForgotStep1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBanner(null);
    setForgotSocialInfo(null);

    try {
      const res = await fetch(AUTH_API.CHECK_LOGIN_METHOD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();

      if (data.exists && data.isSocialUser) {
        if (data.methodLabel && data.signupMethod !== "social") {
          setForgotSocialInfo({
            message: `이 이메일은 ${data.methodLabel}로 가입되어 있습니다.\n${data.methodLabel} 로그인을 이용해 주세요.`,
            method: data.signupMethod,
          });
        } else {
          setForgotSocialInfo({
            message: "이 이메일은 소셜 계정으로 가입되어 있습니다.\n소셜 로그인을 이용해 주세요.",
            method: null,
          });
        }
        setLoading(false);
        return;
      }

      try {
        await userForgotPassword(forgotEmail);
        showBanner("인증코드를 이메일로 보냈습니다.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      } catch {
        showBanner("인증코드를 보냈습니다. 이메일을 확인하세요.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      }
    } catch {
      try {
        await userForgotPassword(forgotEmail);
        showBanner("인증코드를 이메일로 보냈습니다.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      } catch {
        showBanner("인증코드를 보냈습니다. 이메일을 확인하세요.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      }
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 비밀번호 재설정 Step 2
  // ============================================================
  async function handleForgotStep2(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showBanner("새 비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      await userConfirmPassword(forgotEmail, resetCode, newPassword);
      showBanner("비밀번호가 재설정되었습니다.", "success");
      switchView("login");
    } catch (err: any) {
      showBanner(err.message || "재설정 실패", "error");
    } finally {
      setLoading(false);
    }
  }

  return {
    // view state
    view,
    viewKey,
    switchView,
    // banner
    banner,
    setBanner,
    // loading
    loading,
    socialCallbackLoading,
    // login
    loginEmail, setLoginEmail,
    loginPassword, setLoginPassword,
    loginError, setLoginError,
    showLoginPw, setShowLoginPw,
    handleLogin,
    // signup
    signupEmail, setSignupEmail,
    signupFamilyName, setSignupFamilyName,
    signupGivenName, setSignupGivenName,
    signupPassword, setSignupPassword,
    signupPwConfirm, setSignupPwConfirm,
    signupPwConfirmTouched, setSignupPwConfirmTouched,
    showSignupPw, setShowSignupPw,
    showSignupPwConfirm, setShowSignupPwConfirm,
    signupPwFocused, setSignupPwFocused,
    handleSignup,
    // password rules
    pwRules, allPwRulesPassed,
    pwRulesHidden, pwRulesFading,
    resetPwRules, allResetPwRulesPassed,
    // terms
    termsConsent, setTermsConsent,
    consentToastKey,
    // confirm
    verifyCode, setVerifyCode,
    handleConfirmSignup,
    // forgot
    forgotEmail, setForgotEmail,
    forgotSocialInfo, setForgotSocialInfo,
    handleForgotStep1,
    resetCode, setResetCode,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    showResetPw, setShowResetPw,
    showConfirmPw, setShowConfirmPw,
    handleForgotStep2,
    // social
    handleKakaoLogin,
    handleNaverLogin,
    handleGoogleLogin,
    handleAppleLogin,
  };
}
