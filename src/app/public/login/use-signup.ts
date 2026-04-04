import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { userSignup, userConfirmSignup } from "@/auth/user";
import { setRaw } from "@/lib/storage";
import { getPwRules, getErrorMessage } from "./utils";

interface UseSignupDeps {
  hasTermsConsent: boolean;
  showConsentToast: () => void;
  showBanner: (message: string, type: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
  clearBanner: () => void;
  onSignupSuccess: () => void;
  onConfirmSuccess: () => void;
}

export function useSignup({
  hasTermsConsent,
  showConsentToast,
  showBanner,
  setIsLoading,
  clearBanner,
  onSignupSuccess,
  onConfirmSuccess,
}: UseSignupDeps) {
  const [signupEmail, setSignupEmail] = useState("");
  const [signupFamilyName, setSignupFamilyName] = useState("");
  const [signupGivenName, setSignupGivenName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPwConfirm, setSignupPwConfirm] = useState("");
  const [isSignupPwConfirmTouched, setIsSignupPwConfirmTouched] = useState(false);
  const [isSignupPwShown, setIsSignupPwShown] = useState(false);
  const [isSignupPwConfirmShown, setIsSignupPwConfirmShown] = useState(false);
  const [isSignupPwFocused, setIsSignupPwFocused] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");

  // 비밀번호 유효성 검사
  const pwRules = useMemo(() => getPwRules(signupPassword), [signupPassword]);
  const allPwRulesPassed = pwRules.every((r) => r.pass);

  // 비밀번호 규칙 모두 충족 시 0.5초 후 숨김
  const [isPwRulesHidden, setIsPwRulesHidden] = useState(false);
  const [isPwRulesFading, setIsPwRulesFading] = useState(false);
  const pwRulesTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (allPwRulesPassed && signupPassword.length > 0) {
      pwRulesTimerRef.current = setTimeout(() => {
        setIsPwRulesFading(true);
        setTimeout(() => {
          setIsPwRulesHidden(true);
          setIsPwRulesFading(false);
        }, 300);
      }, 500);
    } else {
      if (pwRulesTimerRef.current) clearTimeout(pwRulesTimerRef.current);
      setIsPwRulesHidden(false);
      setIsPwRulesFading(false);
    }
    return () => {
      if (pwRulesTimerRef.current) clearTimeout(pwRulesTimerRef.current);
    };
  }, [allPwRulesPassed, signupPassword.length]);

  // 회원가입
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!allPwRulesPassed) {
      showBanner("비밀번호 조건을 모두 충족해주세요.", "error");
      return;
    }
    if (signupPassword !== signupPwConfirm) {
      setIsSignupPwConfirmTouched(true);
      return;
    }
    if (!hasTermsConsent) {
      showConsentToast();
      return;
    }
    setIsLoading(true);
    clearBanner();

    try {
      await userSignup(
        signupEmail,
        signupPassword,
        signupGivenName.trim(),
        signupFamilyName.trim()
      );
      setRaw("pending_consent", JSON.stringify({
        termsConsent: true,
        termsConsentAt: new Date().toISOString(),
      }));
      showBanner("회원가입 성공! 이메일의 인증코드를 입력해주세요.", "success");
      onSignupSuccess();
    } catch (err: unknown) {
      showBanner(getErrorMessage(err) || "회원가입 실패", "error");
    } finally {
      setIsLoading(false);
    }
  }

  // 회원가입 이메일 인증
  async function handleConfirmSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    clearBanner();

    try {
      await userConfirmSignup(signupEmail, verifyCode);
      showBanner("인��� 완료! 로그인해주세요.", "success");
      onConfirmSuccess();
    } catch (err: unknown) {
      showBanner(getErrorMessage(err) || "인증 실패", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const reset = useCallback(() => {
    setSignupEmail("");
    setSignupFamilyName("");
    setSignupGivenName("");
    setSignupPassword("");
    setSignupPwConfirm("");
    setIsSignupPwConfirmTouched(false);
    setIsSignupPwShown(false);
    setIsSignupPwConfirmShown(false);
    setVerifyCode("");
  }, []);

  return {
    signupEmail, setSignupEmail,
    signupFamilyName, setSignupFamilyName,
    signupGivenName, setSignupGivenName,
    signupPassword, setSignupPassword,
    signupPwConfirm, setSignupPwConfirm,
    isSignupPwConfirmTouched, setIsSignupPwConfirmTouched,
    isSignupPwShown, setIsSignupPwShown,
    isSignupPwConfirmShown, setIsSignupPwConfirmShown,
    isSignupPwFocused, setIsSignupPwFocused,
    verifyCode, setVerifyCode,
    pwRules, allPwRulesPassed,
    isPwRulesHidden, isPwRulesFading,
    handleSignup,
    handleConfirmSignup,
    reset,
  };
}
