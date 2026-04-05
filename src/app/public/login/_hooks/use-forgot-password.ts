import { useState, useMemo, useCallback } from "react";

import { userForgotPassword, userConfirmPassword } from "@/auth/user";
import { AUTH_API } from "@/config/constants";
import { getPwRules, getErrorMessage } from "./utils";

interface CheckLoginMethodResponse {
  exists: boolean;
  isSocialUser?: boolean;
  signupMethod?: string;
  methodLabel?: string;
}

interface UseForgotPasswordDeps {
  showBanner: (message: string, type: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
  clearBanner: () => void;
  onCodeSent: () => void;
  onResetSuccess: () => void;
}

export function useForgotPassword({
  showBanner,
  setIsLoading,
  clearBanner,
  onCodeSent,
  onResetSuccess,
}: UseForgotPasswordDeps) {
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSocialInfo, setForgotSocialInfo] = useState<{
    message: string;
    method: string | null;
  } | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetPwShown, setIsResetPwShown] = useState(false);
  const [isConfirmPwShown, setIsConfirmPwShown] = useState(false);

  const resetPwRules = useMemo(() => getPwRules(newPassword), [newPassword]);
  const allResetPwRulesPassed = resetPwRules.every((r) => r.pass);

  // 비밀번호 재설��� Step 1 — 이메일 입력 → 인증코드 발송
  async function handleForgotStep1(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    clearBanner();
    setForgotSocialInfo(null);

    try {
      const res = await fetch(AUTH_API.CHECK_LOGIN_METHOD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data: CheckLoginMethodResponse = await res.json();

      if (data.exists && data.isSocialUser) {
        if (data.methodLabel && data.signupMethod !== "social") {
          setForgotSocialInfo({
            message: `이 이메일은 ${data.methodLabel}로 가입되어 있습니다.\n${data.methodLabel} 로그인을 이용해 주세요.`,
            method: data.signupMethod ?? null,
          });
        } else {
          setForgotSocialInfo({
            message: "이 이메일은 소셜 계정으로 가입되어 있습니다.\n소셜 로그인을 이용해 주세요.",
            method: null,
          });
        }
        setIsLoading(false);
        return;
      }

      try {
        await userForgotPassword(forgotEmail);
        showBanner("인증코드를 이메일로 보냈습니다.", "success");
        onCodeSent();
      } catch {
        showBanner("인증코드를 보냈습니다. 이메일을 확인하세요.", "success");
        onCodeSent();
      }
    } catch {
      try {
        await userForgotPassword(forgotEmail);
        showBanner("인증코드를 이메일로 보냈습니다.", "success");
        onCodeSent();
      } catch {
        showBanner("인증코드를 보냈습니다. 이메일을 확인하세요.", "success");
        onCodeSent();
      }
    } finally {
      setIsLoading(false);
    }
  }

  // 비밀번호 재설��� Step 2 — 인증코드 + 새 비밀번호 입력
  async function handleForgotStep2(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showBanner("새 비밀번호가 일치하지 않습니다.", "error");
      return;
    }
    setIsLoading(true);
    clearBanner();

    try {
      await userConfirmPassword(forgotEmail, resetCode, newPassword);
      showBanner("비밀번호가 재설정되었습니다.", "success");
      onResetSuccess();
    } catch (err: unknown) {
      showBanner(getErrorMessage(err) || "재설정 실패", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const reset = useCallback(() => {
    setForgotEmail("");
    setForgotSocialInfo(null);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setIsResetPwShown(false);
    setIsConfirmPwShown(false);
  }, []);

  return {
    forgotEmail,
    setForgotEmail,
    forgotSocialInfo,
    setForgotSocialInfo,
    resetCode,
    setResetCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isResetPwShown,
    setIsResetPwShown,
    isConfirmPwShown,
    setIsConfirmPwShown,
    resetPwRules,
    allResetPwRulesPassed,
    handleForgotStep1,
    handleForgotStep2,
    reset,
  };
}
