import { useState, useEffect, useCallback, useRef } from "react";

import { getSession, removeSession } from "@/lib/storage";

import { useSocialLogin } from "./use-social-login";
import { useEmailLogin } from "./use-email-login";
import { useSignup } from "./use-signup";
import { useForgotPassword } from "./use-forgot-password";

export type View = "login" | "signup" | "confirm" | "forgotStep1" | "forgotStep2";

type BannerType = "success" | "error";

export interface BannerState {
  message: string;
  type: BannerType;
}

export function useLoginPage() {
  // 마이페이지에서 로그아웃 후 들어온 경우 → 뒤로가기 무시
  useEffect(() => {
    if (typeof window === "undefined") return;
    const from = getSession("logoutFrom");
    if (from !== "mypage") return;

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

  // 로딩
  const [isLoading, setIsLoading] = useState(false);

  // 인라인 배너
  const [banner, setBanner] = useState<BannerState | null>(null);
  const showBanner = useCallback((message: string, type: BannerType) => {
    setBanner({ message, type });
  }, []);
  const clearBanner = useCallback(() => setBanner(null), []);

  // 배너 자동 사라짐: 성공 배너만 5초 후 사라짐
  useEffect(() => {
    if (!banner) return;
    if (banner.type === "success") {
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  // 약관 동의
  const [hasTermsConsent, setHasTermsConsent] = useState(false);
  const [consentToastKey, setConsentToastKey] = useState(0);
  const consentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showConsentToast = useCallback(() => {
    if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    setConsentToastKey((k) => k + 1);
    consentTimerRef.current = setTimeout(() => setConsentToastKey(0), 3100);
  }, []);

  // switchView ref — 서브훅 콜백과 순환 의존 해결용
  const switchViewRef = useRef<(v: View) => void>(() => {});

  // 서브훅 성공 콜백 (switchView를 ref로 참조)
  const onSignupSuccess = useCallback(() => switchViewRef.current("confirm"), []);
  const onConfirmSuccess = useCallback(() => switchViewRef.current("login"), []);
  const onCodeSent = useCallback(() => {
    setViewKey((k) => k + 1);
    setView("forgotStep2");
  }, []);
  const onResetSuccess = useCallback(() => switchViewRef.current("login"), []);

  // ── 서브훅 조합 ──
  const social = useSocialLogin({ hasTermsConsent, showConsentToast, showBanner });

  const emailLogin = useEmailLogin({ setIsLoading, clearBanner });

  const signup = useSignup({
    hasTermsConsent,
    showConsentToast,
    showBanner,
    setIsLoading,
    clearBanner,
    onSignupSuccess,
    onConfirmSuccess,
  });

  const forgotPw = useForgotPassword({
    showBanner,
    setIsLoading,
    clearBanner,
    onCodeSent,
    onResetSuccess,
  });

  // 뷰 전환 (전체 상태 리셋)
  const switchView = useCallback(
    (v: View) => {
      setBanner(null);
      setIsLoading(false);
      emailLogin.reset();
      signup.reset();
      forgotPw.reset();
      setViewKey((k) => k + 1);
      setView(v);
    },
    [emailLogin.reset, signup.reset, forgotPw.reset]
  );

  switchViewRef.current = switchView;

  // ── 기존 useLoginPage와 동일한 return 인터페이스 ──
  return {
    // view state
    view,
    viewKey,
    switchView,
    // banner
    banner,
    setBanner,
    // loading
    isLoading,
    isSocialCallbackLoading: social.isSocialCallbackLoading,
    // login
    loginEmail: emailLogin.loginEmail,
    setLoginEmail: emailLogin.setLoginEmail,
    loginPassword: emailLogin.loginPassword,
    setLoginPassword: emailLogin.setLoginPassword,
    loginError: emailLogin.loginError,
    setLoginError: emailLogin.setLoginError,
    isLoginPwShown: emailLogin.isLoginPwShown,
    setIsLoginPwShown: emailLogin.setIsLoginPwShown,
    handleLogin: emailLogin.handleLogin,
    // signup
    signupEmail: signup.signupEmail,
    setSignupEmail: signup.setSignupEmail,
    signupFamilyName: signup.signupFamilyName,
    setSignupFamilyName: signup.setSignupFamilyName,
    signupGivenName: signup.signupGivenName,
    setSignupGivenName: signup.setSignupGivenName,
    signupPassword: signup.signupPassword,
    setSignupPassword: signup.setSignupPassword,
    signupPwConfirm: signup.signupPwConfirm,
    setSignupPwConfirm: signup.setSignupPwConfirm,
    isSignupPwConfirmTouched: signup.isSignupPwConfirmTouched,
    setIsSignupPwConfirmTouched: signup.setIsSignupPwConfirmTouched,
    isSignupPwShown: signup.isSignupPwShown,
    setIsSignupPwShown: signup.setIsSignupPwShown,
    isSignupPwConfirmShown: signup.isSignupPwConfirmShown,
    setIsSignupPwConfirmShown: signup.setIsSignupPwConfirmShown,
    isSignupPwFocused: signup.isSignupPwFocused,
    setIsSignupPwFocused: signup.setIsSignupPwFocused,
    handleSignup: signup.handleSignup,
    // password rules
    pwRules: signup.pwRules,
    allPwRulesPassed: signup.allPwRulesPassed,
    isPwRulesHidden: signup.isPwRulesHidden,
    isPwRulesFading: signup.isPwRulesFading,
    resetPwRules: forgotPw.resetPwRules,
    allResetPwRulesPassed: forgotPw.allResetPwRulesPassed,
    // terms
    hasTermsConsent,
    setHasTermsConsent,
    consentToastKey,
    // confirm
    verifyCode: signup.verifyCode,
    setVerifyCode: signup.setVerifyCode,
    handleConfirmSignup: signup.handleConfirmSignup,
    // forgot
    forgotEmail: forgotPw.forgotEmail,
    setForgotEmail: forgotPw.setForgotEmail,
    forgotSocialInfo: forgotPw.forgotSocialInfo,
    setForgotSocialInfo: forgotPw.setForgotSocialInfo,
    handleForgotStep1: forgotPw.handleForgotStep1,
    resetCode: forgotPw.resetCode,
    setResetCode: forgotPw.setResetCode,
    newPassword: forgotPw.newPassword,
    setNewPassword: forgotPw.setNewPassword,
    confirmPassword: forgotPw.confirmPassword,
    setConfirmPassword: forgotPw.setConfirmPassword,
    isResetPwShown: forgotPw.isResetPwShown,
    setIsResetPwShown: forgotPw.setIsResetPwShown,
    isConfirmPwShown: forgotPw.isConfirmPwShown,
    setIsConfirmPwShown: forgotPw.setIsConfirmPwShown,
    handleForgotStep2: forgotPw.handleForgotStep2,
    // social
    handleKakaoLogin: social.handleKakaoLogin,
    handleNaverLogin: social.handleNaverLogin,
    handleGoogleLogin: social.handleGoogleLogin,
    handleAppleLogin: social.handleAppleLogin,
  };
}
