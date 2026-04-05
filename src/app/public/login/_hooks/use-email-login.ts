import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { userLogin } from "@/auth/user";
import { recordLogin, sendPendingConsent, getPostLoginRedirect, getErrorMessage } from "./utils";

interface UseEmailLoginDeps {
  setIsLoading: (v: boolean) => void;
  clearBanner: () => void;
}

export function useEmailLogin({ setIsLoading, clearBanner }: UseEmailLoginDeps) {
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoginPwShown, setIsLoginPwShown] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");
    clearBanner();

    try {
      const result = await userLogin(loginEmail, loginPassword);
      recordLogin(result.idToken);
      sendPendingConsent(result.idToken);
      import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
      router.replace(getPostLoginRedirect());
    } catch {
      setLoginError("이메일 주소 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  const reset = useCallback(() => {
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setIsLoginPwShown(false);
  }, []);

  return {
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    setLoginError,
    isLoginPwShown,
    setIsLoginPwShown,
    handleLogin,
    reset,
  };
}
