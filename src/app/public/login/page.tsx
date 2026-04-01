"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import PublicHeader from "@/components/publicSite/PublicHeader";
import styles from "./login.module.css";

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

import { getSession, removeSession, getRaw, setRaw, removeRaw } from "@/lib/storage";

/** 로그인 성공 후 lastLoginAt 기록 (fire-and-forget) */
function recordLogin(idToken: string) {
  const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL || "";
  if (!API_BASE) return;
  fetch(`${API_BASE}/user/record-login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {}); // 실패해도 로그인 흐름 차단하지 않음
}

/**
 * 회원가입/소셜 로그인 시 임시 저장된 동의 정보를 AWS에 전송 (fire-and-forget)
 * ✅ storage 추상화 레이어 경유 — 앱 전환 시 AsyncStorage 등으로 자동 대응
 * ※ 마케팅 동의는 프로필 설정에서 별도로 받으므로 여기서는 이용약관만 전송
 */
function sendPendingConsent(idToken: string) {
  try {
    const pending = getRaw("pending_consent");
    if (!pending) return;

    const consentData = JSON.parse(pending);
    removeRaw("pending_consent");

    // ⚠️ 기존 프로필이 있는 사용자의 데이터를 덮어쓰지 않도록 보호
    // 먼저 AWS에 프로필이 존재하는지 확인한 후, 없을 때만 동의 정보 전송
    fetch("/api/user/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return; // 조회 실패 시 안전하게 스킵

        // AWS 응답 구조 유연하게 처리 (플랫 또는 중첩 구조)
        const profile = data.profile || data;
        const alreadyDone =
          data.profileSetupDone || profile.profileSetupDone || profile.wellnessGoal;

        if (alreadyDone) {
          console.log("[Consent] 프로필 이미 완료 → 동의 정보 전송 스킵");
          return; // 이미 완성된 프로필이 있으면 덮어쓰지 않음
        }

        // 프로필 없음 → 신규 사용자이므로 동의 정보만 전송
        fetch("/api/user/profile", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            termsConsent: consentData.termsConsent ?? true,
            termsConsentAt: consentData.termsConsentAt ?? new Date().toISOString(),
          }),
        }).catch(() => {});
      })
      .catch(() => {}); // 전체 실패해도 로그인 흐름 차단하지 않음
  } catch {}
}

/** 로그인 후 리다이렉트 경로 결정 (기본 /home) */
function getPostLoginRedirect(): string {
  const saved = getSession("redirect_after_login");
  if (saved) {
    removeSession("redirect_after_login");
    return saved;
  }

  // 프로필 설정 여부는 /home의 checkProfileSetup()이 판단
  // (localStorage → AWS fallback 체인으로 정확한 확인)
  // localStorage만으로는 새 기기/브라우저에서 오판할 수 있으므로
  // 로그인 페이지에서는 프로필 체크를 하지 않음
  return "/home";
}

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

type View =
  | "login"
  | "signup"
  | "confirm"
  | "forgotStep1"
  | "forgotStep2";

type BannerType = "success" | "error";

interface BannerState {
  message: string;
  type: BannerType;
}

// ============================================================
// 아이콘 컴포넌트 (SVG inline — 외부 의존성 없음)
// ============================================================
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    </svg>
  );
}

// 네이버 공식 "N" 심볼 (SVG)
function NaverSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
    </svg>
  );
}

// 구글 공식 "G" 심볼 (SVG — 4색 로고)
function GoogleSymbol() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: 22, height: 22 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// 애플 공식 로고 심볼 (SVG)
function AppleSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// 카카오 공식 말풍선 심볼 (SVG)
function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="#000000" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24 }}>
      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.72 1.8 5.108 4.516 6.467-.147.529-.946 3.406-.978 3.627 0 0-.02.165.087.228.107.063.233.014.233.014.307-.043 3.558-2.326 4.118-2.72.655.096 1.332.147 2.024.147 5.523 0 10-3.463 10-7.763C22 6.463 17.523 3 12 3z" />
    </svg>
  );
}

// ============================================================
// 메인 페이지 래퍼 (Suspense boundary for useSearchParams)
// ============================================================
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
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
      return; // 일반 진입(landing → login 등)은 그대로 두기
    }

    const handlePopState = () => {
      // 현재 로그인 페이지를 다시 스택에 쌓아서
      // 뒤로가기를 눌러도 계속 로그인 페이지에 머물도록 함
      window.history.pushState(null, "", window.location.href);
    };

    // 처음 한 번 현재 상태를 한 번 더 쌓고
    window.history.pushState(null, "", window.location.href);
    // popstate 리스너 등록
    window.addEventListener("popstate", handlePopState);

    return () => {
      // 컴포넌트 떠날 때 정리 및 플래그 제거
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
    // 이전 타이머 클리어
    if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    setConsentToastKey((k) => k + 1);
    // 애니메이션 총 시간(나타남 0.3s + 유지 2.5s + 사라짐 0.25s = ~3.1s) 후 리셋
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
  const [error, setError] = useState("");
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
  // 서버 콜백이 URL에 ?auth_code=xxx&auth_provider=kakao|naver|google|apple 을 붙여서 리다이렉트함
  // 이 코드가 /api/public/auth/exchange API를 호출해서 실제 Cognito 토큰으로 교환
  useEffect(() => {
    if (typeof window === "undefined") return;

    const authCode = searchParams.get("auth_code");
    const authProvider = searchParams.get("auth_provider");

    if (!authCode || !authProvider) return;

    // 교환 코드 → 토큰 교환 (비동기)
    (async () => {
      try {
        const res = await fetch("/api/public/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: authCode }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "토큰 교환에 실패했습니다.");
        }

        const { idToken, accessToken } = await res.json();

        // provider별 세션 저장 함수 호출
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
        // 구독 정보 프리페치 (fire-and-forget: 홈 도착 전에 캐시 채우기)
        import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
        router.replace(getPostLoginRedirect());
      } catch (err: any) {
        showBanner(err.message || "소셜 로그인 처리 중 오류가 발생했습니다.", "error");
        window.history.replaceState({}, "", "/public/login");
      }
    })();
  }, [searchParams, router, showBanner]);

  // -----------------------------
  // 서버에서 OAuth state를 받아오는 헬퍼
  // -----------------------------
  async function fetchOAuthState(provider: string): Promise<string> {
    const res = await fetch("/api/public/auth/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) throw new Error("OAuth state 생성 실패");
    const { state } = await res.json();
    return state;
  }

  // -----------------------------
  // 🟡 카카오 로그인 핸들러
  // (카카오는 state를 사용하지 않으므로 기존 방식 유지)
  // -----------------------------
  /** 소셜 로그인 전 동의 정보를 storage에 임시 저장 (신규 사용자만) */
  function saveSocialConsent() {
    // 이미 프로필 설정을 완료한 사용자는 동의 정보를 다시 저장하지 않음
    // (재로그인 시 AWS 프로필이 덮어써지는 것을 방지)
    // ※ userId별 키를 확인하기 어려우므로 sendPendingConsent에서도 이중 방어
    setRaw("pending_consent", JSON.stringify({
      termsConsent: true,
      termsConsentAt: new Date().toISOString(),
    }));
  }

  function handleKakaoLogin() {
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    saveSocialConsent();
    window.location.href = getKakaoLoginUrl();
  }

  // -----------------------------
  // 🟢 네이버 로그인 핸들러
  // -----------------------------
  async function handleNaverLogin() {
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    try {
      saveSocialConsent();
      const state = await fetchOAuthState("naver");
      window.location.href = getNaverLoginUrl(state);
    } catch {
      showBanner("네이버 로그인 준비 중 오류가 발생했습니다.", "error");
    }
  }

  // -----------------------------
  // 🔵 구글 로그인 핸들러
  // -----------------------------
  async function handleGoogleLogin() {
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    try {
      saveSocialConsent();
      const state = await fetchOAuthState("google");
      window.location.href = getGoogleLoginUrl(state);
    } catch {
      showBanner("구글 로그인 준비 중 오류가 발생했습니다.", "error");
    }
  }

  // -----------------------------
  // 🍎 애플 로그인 핸들러
  // -----------------------------
  async function handleAppleLogin() {
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    try {
      saveSocialConsent();
      const state = await fetchOAuthState("apple");
      window.location.href = getAppleLoginUrl(state);
    } catch {
      showBanner("애플 로그인 준비 중 오류가 발생했습니다.", "error");
    }
  }

  // -----------------------------
  // 소셜 로그인 에러 파라미터 처리 (각 provider별 에러 URL 파라미터)
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const providerErrors: { param: string; label: string }[] = [
      { param: "kakao_error", label: "카카오" },
      { param: "naver_error", label: "네이버" },
      { param: "google_error", label: "구글" },
      { param: "apple_error", label: "애플" },
    ];

    for (const { param, label } of providerErrors) {
      const errValue = searchParams.get(param);
      if (errValue) {
        const errorMsg =
          errValue === "cancelled"
            ? `${label} 로그인이 취소되었습니다.`
            : decodeURIComponent(errValue);
        showBanner(errorMsg, "error");
        window.history.replaceState({}, "", "/public/login");
        break; // 에러 하나만 표시
      }
    }
  }, [searchParams, showBanner]);

  const switchView = (v: View) => {
    // 에러/배너 초기화
    setError("");
    setBanner(null);
    setLoading(false);
    setLoginError("");
    setForgotSocialInfo(null);

    // 모든 입력 필드 초기화
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

    // 비밀번호 보기 토글 초기화
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
  // 비밀번호 유효성 검사 (회원가입용)
  // ============================================================
  const pwRules = [
    { label: "8자 이상", pass: signupPassword.length >= 8 },
    { label: "숫자 포함", pass: /\d/.test(signupPassword) },
    { label: "영문 대문자 포함", pass: /[A-Z]/.test(signupPassword) },
    { label: "특수문자 포함", pass: /[^A-Za-z0-9]/.test(signupPassword) },
  ];
  const allPwRulesPassed = pwRules.every((r) => r.pass);

  // 비밀번호 규칙 모두 충족 시 0.5초 후 숨김
  const [pwRulesHidden, setPwRulesHidden] = useState(false);
  const [pwRulesFading, setPwRulesFading] = useState(false);
  const pwRulesTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (allPwRulesPassed && signupPassword.length > 0) {
      pwRulesTimerRef.current = setTimeout(() => {
        setPwRulesFading(true);
        // 페이드아웃 애니메이션(0.3s) 후 완전히 숨김
        setTimeout(() => {
          setPwRulesHidden(true);
          setPwRulesFading(false);
        }, 300);
      }, 500);
    } else {
      // 조건 미충족 시 다시 보이기
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
    if (signupPassword !== signupPwConfirm) {
      setSignupPwConfirmTouched(true);
      return;
    }
    if (!termsConsent) {
      showConsentToast();
      return;
    }
    setLoading(true);
    setError("");
    setBanner(null);

    try {
      await userSignup(
        signupEmail,
        signupPassword,
        signupGivenName,
        signupFamilyName
      );

      // 동의 기록을 임시 저장 (이메일 인증 → 로그인 후 AWS에 전송)
      // ✅ storage 추상화 레이어 경유 — 앱 전환 시 AsyncStorage 등으로 자동 대응
      // ※ 마케팅 동의는 프로필 설정에서 별도로 받음
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
    setError("");
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
      // 구독 정보 프리페치 (fire-and-forget: 홈 도착 전에 캐시 채우기)
      import("@/auth/subscription").then((m) => m.prefetchSubscriptions());
      router.replace(getPostLoginRedirect());
    } catch (err: any) {
      // 보안: 이메일 존재 여부·가입 경로를 노출하지 않도록
      // 어떤 실패든 동일한 통합 메시지만 표시 (인라인)
      setLoginError("이메일 주소 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 비밀번호 재설정 Step 1
  // — 소셜 가입자인 경우 가입 경로를 안내하고 인증코드를 보내지 않음
  // ============================================================
  async function handleForgotStep1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setBanner(null);
    setForgotSocialInfo(null);

    try {
      // 먼저 가입 경로 확인
      const res = await fetch("/api/public/auth/check-login-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();

      // 소셜 가입자 → 인라인 안내 + 해당 소셜 로그인 버튼
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

      // 이메일 가입자 또는 미가입자 → 인증코드 발송
      // 주의: forgotEmail을 유지해야 하므로 switchView 대신 직접 뷰 전환
      try {
        await userForgotPassword(forgotEmail);
        showBanner("인증코드를 이메일로 보냈습니다.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      } catch {
        // 미가입 이메일이어도 동일 메시지 (보안)
        showBanner("인증코드를 보냈습니다. 이메일을 확인하세요.", "success");
        setViewKey((k) => k + 1);
        setView("forgotStep2");
      }
    } catch {
      // check-login-method API 실패 시 기존 흐름 유지
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

    // 비밀번호 일치 검증
    if (newPassword !== confirmPassword) {
      showBanner("새 비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    setLoading(true);
    setError("");
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

  // ============================================================
  // 배너 렌더링 헬퍼
  // ============================================================
  const renderBanner = () => {
    if (!banner) return null;
    return (
      <div
        className={`${styles.banner} ${
          banner.type === "success" ? styles.bannerSuccess : styles.bannerError
        }`}
      >
        <span className={styles.bannerMessage}>{banner.message}</span>
        {banner.type === "error" && (
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setBanner(null)}
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // ============================================================
  // 화면 렌더링
  // ============================================================
  return (
    <>
      <PublicHeader />

      <main className={styles.loginPage}>
        <div className={styles.mainContent}>
          {/* ===============================
              좌측 브랜드 비주얼 영역
          =============================== */}
          <section className={styles.leftFrame}>
            <Image
              src="/assets/images/webp/wellness.webp"
              alt=""
              fill
              sizes="(max-width: 768px) 0px, 45vw"
              className={styles.leftBgImage}
            />
            <div className={styles.leftContent}>
              <Image
                src="/assets/images/webp/Logo_HealEcho.webp"
                alt="Heal Echo"
                width={80}
                height={80}
                className={styles.leftLogo}
              />
              <h2 className={styles.leftBrand}>Heal Echo</h2>
              <p className={styles.leftSlogan}>
                하루 15분,<br />
                당신을 위한 맞춤 웰니스 솔루션
              </p>
              <div className={styles.leftAccent} />
            </div>
          </section>

          {/* ===============================
              우측 폼 영역
          =============================== */}
          <section className={styles.rightFrame}>
            {/* ===============================
                로그인 화면
            =============================== */}
            {view === "login" && (
              <div key={viewKey} className={styles.rightFrameContainer}>
                {renderBanner()}

                <h1 className={styles.bigTitle}>로그인</h1>

                <div className={styles.subtitleFrame}>
                  <span className={styles.subtitleLeft}>처음 오셨나요?</span>
                  <button
                    type="button"
                    className={styles.subtitleRight}
                    onClick={() => switchView("signup")}
                  >
                    회원가입
                  </button>
                </div>

                <form className={styles.emailLoginBox} onSubmit={handleLogin}>
                  <input
                    type="email"
                    placeholder="이메일 주소"
                    required
                    className={`${styles.emailInput} ${loginError ? styles.inputError : ""}`}
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setLoginError(""); }}
                  />

                  <div className={styles.passwordWrapper}>
                    <input
                      type={showLoginPw ? "text" : "password"}
                      placeholder="비밀번호"
                      required
                      className={`${styles.emailInput} ${loginError ? styles.inputError : ""}`}
                      value={loginPassword}
                      onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowLoginPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showLoginPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showLoginPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {loginError && (
                    <div className={styles.loginErrorBlock}>
                      <p className={styles.loginErrorText}>{loginError}</p>
                      <div className={styles.loginErrorLinks}>
                        <span
                          className={styles.loginErrorLink}
                          onClick={() => switchView("forgotStep1")}
                        >
                          비밀번호를 잊으셨나요?
                        </span>
                        <span className={styles.loginErrorDot}>·</span>
                        <span
                          className={styles.loginErrorLink}
                          onClick={() => switchView("signup")}
                        >
                          계정이 없으신가요? 회원가입
                        </span>
                      </div>
                    </div>
                  )}

                  {!loginError && (
                    <span
                      className={styles.forgotPassword}
                      onClick={() => switchView("forgotStep1")}
                    >
                      비밀번호 찾기
                    </span>
                  )}

                  <button type="submit" className={styles.continueButton}>
                    {loading ? "로그인 중..." : "로그인"}
                  </button>
                </form>

                {/* -----------------------------
                    구분선 + 소셜 로그인 아이콘
                ------------------------------ */}
                <div className={styles.divider}>
                  <span className={styles.dividerLine} />
                  <span className={styles.dividerText}>또는</span>
                  <span className={styles.dividerLine} />
                </div>

                {/* 소셜 로그인용 약관 동의 체크박스 */}
                <div className={styles.consentGroup}>
                  {consentToastKey > 0 && (
                    <div key={consentToastKey} className={styles.consentBubble}>
                      필수 동의 항목에 동의해주세요
                    </div>
                  )}
                  <label className={styles.consentLabel}>
                    <input
                      type="checkbox"
                      className={styles.consentCheckbox}
                      checked={termsConsent}
                      onChange={(e) => setTermsConsent(e.target.checked)}
                    />
                    <span className={styles.consentText}>
                      <span className={styles.consentBadge}>(필수)</span>{" "}
                      이용약관 및 개인정보 수집·이용에 동의합니다.{" "}
                      <a
                        href="/public/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.consentViewLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        전문보기
                      </a>
                    </span>
                  </label>
                </div>

                <div className={styles.socialIcons}>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialKakao}`} aria-label="카카오 로그인" onClick={handleKakaoLogin}>
                    <KakaoSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialNaver}`} aria-label="네이버 로그인" onClick={handleNaverLogin}>
                    <NaverSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialGoogle}`} aria-label="구글 로그인" onClick={handleGoogleLogin}>
                    <GoogleSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialApple}`} aria-label="애플 로그인" onClick={handleAppleLogin}>
                    <AppleSymbol />
                  </button>
                </div>
              </div>
            )}

            {/* ===============================
                회원가입 화면
            =============================== */}
            {view === "signup" && (
              <div key={viewKey} className={styles.rightFrameContainer}>
                {renderBanner()}

                <h1 className={styles.bigTitle}>회원 가입</h1>

                <div className={styles.subtitleFrame}>
                  <span className={styles.subtitleLeft}>이미 회원이신가요?</span>
                  <button
                    type="button"
                    className={styles.subtitleRight}
                    onClick={() => switchView("login")}
                  >
                    로그인
                  </button>
                </div>

                <form className={styles.emailLoginBox} onSubmit={handleSignup}>
                  <input
                    type="text"
                    placeholder="성 (필수)"
                    required
                    className={styles.emailInput}
                    value={signupFamilyName}
                    onChange={(e) => setSignupFamilyName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="이름 (필수)"
                    required
                    className={styles.emailInput}
                    value={signupGivenName}
                    onChange={(e) => setSignupGivenName(e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="이메일 주소 (필수)"
                    required
                    className={styles.emailInput}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />

                  <div className={styles.passwordWrapper}>
                    <input
                      type={showSignupPw ? "text" : "password"}
                      placeholder="비밀번호 (8자 이상)"
                      required
                      className={styles.emailInput}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      onFocus={() => setSignupPwFocused(true)}
                      onBlur={() => setSignupPwFocused(false)}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowSignupPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showSignupPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showSignupPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {/* 비밀번호 유효성 실시간 체크 */}
                  {(signupPwFocused || signupPassword.length > 0) && !pwRulesHidden && (
                    <div className={`${styles.pwRules} ${pwRulesFading ? styles.pwRulesFadeOut : ""}`}>
                      {pwRules.map((rule) => (
                        <div
                          key={rule.label}
                          className={`${styles.pwRule} ${
                            rule.pass ? styles.pwRulePass : styles.pwRuleFail
                          }`}
                        >
                          {rule.pass ? <CheckCircleIcon /> : <CircleIcon />}
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 비밀번호 확인 */}
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showSignupPwConfirm ? "text" : "password"}
                      placeholder="비밀번호 확인"
                      required
                      className={`${styles.emailInput} ${
                        signupPwConfirmTouched && signupPwConfirm.length > 0 && signupPassword !== signupPwConfirm
                          ? styles.inputMismatch
                          : ""
                      }`}
                      value={signupPwConfirm}
                      onChange={(e) => {
                        setSignupPwConfirm(e.target.value);
                        if (!signupPwConfirmTouched) setSignupPwConfirmTouched(true);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowSignupPwConfirm((v) => !v)}
                      tabIndex={-1}
                      aria-label={showSignupPwConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showSignupPwConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {signupPwConfirmTouched && signupPwConfirm.length > 0 && signupPassword !== signupPwConfirm && (
                    <p className={styles.pwMismatch}>비밀번호가 일치하지 않습니다</p>
                  )}

                  {/* 약관 동의 체크박스 */}
                  <div className={styles.consentGroup}>
                    {consentToastKey > 0 && (
                      <div key={consentToastKey} className={styles.consentBubble}>
                        필수 동의 항목에 동의해주세요
                      </div>
                    )}
                    <label className={styles.consentLabel}>
                      <input
                        type="checkbox"
                        className={styles.consentCheckbox}
                        checked={termsConsent}
                        onChange={(e) => setTermsConsent(e.target.checked)}
                      />
                      <span className={styles.consentText}>
                        <span className={styles.consentBadge}>(필수)</span>{" "}
                        이용약관 및 개인정보 수집·이용에 동의합니다.{" "}
                        <a
                          href="/public/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.consentViewLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          전문보기
                        </a>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className={styles.continueButton}
                    disabled={loading}
                  >
                    {loading ? "처리 중..." : "회원가입"}
                  </button>
                </form>

                {/* -----------------------------
                    구분선 + 소셜 회원가입 아이콘
                ------------------------------ */}
                <div className={styles.divider}>
                  <span className={styles.dividerLine} />
                  <span className={styles.dividerText}>또는</span>
                  <span className={styles.dividerLine} />
                </div>

                <div className={styles.socialIcons}>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialKakao}`} aria-label="카카오 회원가입" onClick={handleKakaoLogin}>
                    <KakaoSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialNaver}`} aria-label="네이버 회원가입" onClick={handleNaverLogin}>
                    <NaverSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialGoogle}`} aria-label="구글 회원가입" onClick={handleGoogleLogin}>
                    <GoogleSymbol />
                  </button>
                  <button type="button" className={`${styles.socialIconBtn} ${styles.socialApple}`} aria-label="애플 회원가입" onClick={handleAppleLogin}>
                    <AppleSymbol />
                  </button>
                </div>
              </div>
            )}

            {/* ===============================
                이메일 인증 화면
            =============================== */}
            {view === "confirm" && (
              <div key={viewKey} className={styles.rightFrameContainer}>
                {renderBanner()}

                <h1 className={styles.bigTitle}>이메일 인증</h1>

                <div className={styles.subtitleFrame}>
                  <span className={styles.subtitleLeft}></span>
                  <button
                    type="button"
                    className={styles.subtitleRight}
                    onClick={() => switchView("login")}
                  >
                    로그인으로 돌아가기
                  </button>
                </div>

                <form className={styles.emailLoginBox} onSubmit={handleConfirmSignup}>
                  <input
                    type="text"
                    placeholder="인증 코드"
                    required
                    className={styles.emailInput}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                  />
                  <button type="submit" className={styles.continueButton}>
                    {loading ? "확인 중..." : "인증 확인"}
                  </button>
                </form>
              </div>
            )}

            {/* ===============================
                비밀번호 재설정 Step 1
            =============================== */}
            {view === "forgotStep1" && (
              <div key={viewKey} className={styles.rightFrameContainer}>
                {renderBanner()}

                <h1 className={styles.bigTitle}>비밀번호 재설정</h1>

                <div className={styles.subtitleFrame}>
                  <span className={styles.subtitleLeft}>이메일을 입력해 주세요</span>
                  <button
                    type="button"
                    className={styles.subtitleRight}
                    onClick={() => switchView("login")}
                  >
                    로그인으로 돌아가기
                  </button>
                </div>

                <form className={styles.emailLoginBox} onSubmit={handleForgotStep1}>
                  <input
                    type="email"
                    placeholder="이메일 주소"
                    required
                    className={`${styles.emailInput} ${forgotSocialInfo ? styles.inputError : ""}`}
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotSocialInfo(null); }}
                  />

                  {/* 소셜 가입자 인라인 안내 */}
                  {forgotSocialInfo && (
                    <div className={styles.forgotSocialBlock}>
                      <p className={styles.forgotSocialText}>
                        {forgotSocialInfo.message.split("\n").map((line, i) => (
                          <span key={i}>
                            {line}
                            {i === 0 && <br />}
                          </span>
                        ))}
                      </p>

                      {/* 해당 소셜 로그인 버튼 */}
                      <div className={styles.forgotSocialButtons}>
                        {forgotSocialInfo.method === "kakao" && (
                          <button type="button" className={`${styles.socialLoginBtn} ${styles.socialLoginKakao}`} onClick={handleKakaoLogin}>
                            <KakaoSymbol />
                            <span>카카오로 로그인</span>
                          </button>
                        )}
                        {forgotSocialInfo.method === "naver" && (
                          <button type="button" className={`${styles.socialLoginBtn} ${styles.socialLoginNaver}`} onClick={handleNaverLogin}>
                            <NaverSymbol />
                            <span>네이버로 로그인</span>
                          </button>
                        )}
                        {forgotSocialInfo.method === "google" && (
                          <button type="button" className={`${styles.socialLoginBtn} ${styles.socialLoginGoogle}`} onClick={handleGoogleLogin}>
                            <GoogleSymbol />
                            <span>구글로 로그인</span>
                          </button>
                        )}
                        {forgotSocialInfo.method === "apple" && (
                          <button type="button" className={`${styles.socialLoginBtn} ${styles.socialLoginApple}`} onClick={handleAppleLogin}>
                            <AppleSymbol />
                            <span>애플로 로그인</span>
                          </button>
                        )}
                        {/* method가 null이면 가입 경로 미상 → 전체 소셜 버튼 */}
                        {forgotSocialInfo.method === null && (
                          <div className={styles.socialIcons}>
                            <button type="button" className={`${styles.socialIconBtn} ${styles.socialKakao}`} aria-label="카카오 로그인" onClick={handleKakaoLogin}>
                              <KakaoSymbol />
                            </button>
                            <button type="button" className={`${styles.socialIconBtn} ${styles.socialNaver}`} aria-label="네이버 로그인" onClick={handleNaverLogin}>
                              <NaverSymbol />
                            </button>
                            <button type="button" className={`${styles.socialIconBtn} ${styles.socialGoogle}`} aria-label="구글 로그인" onClick={handleGoogleLogin}>
                              <GoogleSymbol />
                            </button>
                            <button type="button" className={`${styles.socialIconBtn} ${styles.socialApple}`} aria-label="애플 로그인" onClick={handleAppleLogin}>
                              <AppleSymbol />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!forgotSocialInfo && (
                    <button type="submit" className={styles.continueButton}>
                      {loading ? "전송 중..." : "인증코드 받기"}
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* ===============================
                비밀번호 재설정 Step 2
            =============================== */}
            {view === "forgotStep2" && (
              <div key={viewKey} className={styles.rightFrameContainer}>
                {renderBanner()}

                <h1 className={styles.bigTitle}>새 비밀번호 설정</h1>

                <div className={styles.subtitleFrame}>
                  <span className={styles.subtitleLeft}></span>
                  <button
                    type="button"
                    className={styles.subtitleRight}
                    onClick={() => switchView("login")}
                  >
                    로그인으로 돌아가기
                  </button>
                </div>

                <form className={styles.emailLoginBox} onSubmit={handleForgotStep2}>
                  <input
                    type="text"
                    placeholder="인증 코드"
                    required
                    className={styles.emailInput}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                  />

                  <div className={styles.passwordWrapper}>
                    <input
                      type={showResetPw ? "text" : "password"}
                      placeholder="새 비밀번호 (8자 이상)"
                      required
                      className={styles.emailInput}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowResetPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showResetPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showResetPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  <div className={styles.passwordWrapper}>
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      placeholder="새 비밀번호 확인"
                      required
                      className={`${styles.emailInput} ${
                        confirmPassword.length > 0 && newPassword !== confirmPassword
                          ? styles.inputError
                          : ""
                      }`}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowConfirmPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirmPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {/* 비밀번호 불일치 실시간 안내 */}
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className={styles.loginErrorText}>비밀번호가 일치하지 않습니다.</p>
                  )}

                  <button
                    type="submit"
                    className={styles.continueButton}
                    disabled={confirmPassword.length > 0 && newPassword !== confirmPassword}
                  >
                    {loading ? "변경 중..." : "비밀번호 재설정"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>

    </>
  );
}
