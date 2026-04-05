import { getSession, removeSession, getRaw, removeRaw } from "@/lib/storage";
import { USER_API } from "@/config/constants";

interface ProfileCheckResponse {
  profileSetupDone?: boolean;
  wellnessGoal?: string;
  profile?: {
    profileSetupDone?: boolean;
    wellnessGoal?: string;
  };
}

/** 로그인 성공 후 lastLoginAt 기록 (fire-and-forget) — Next.js API 프록시 경유 */
export function recordLogin(idToken: string) {
  fetch("/api/user/record-login", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  }).catch((err) => console.warn("[recordLogin] failed:", err)); // 실패해도 로그인 흐름 차단하지 않음
}

/**
 * 회원가입/소셜 로그인 시 임시 저장된 동의 정보를 AWS에 전송 (fire-and-forget)
 * ✅ storage 추상화 레이어 경유 — 앱 전환 시 AsyncStorage 등으로 자동 대응
 * ※ 마케팅 동의는 프로필 설정에서 별도로 받으므로 여기서는 이용약관만 전송
 */
export function sendPendingConsent(idToken: string) {
  try {
    const pending = getRaw("pending_consent");
    if (!pending) return;

    const consentData = JSON.parse(pending);
    removeRaw("pending_consent");

    // ⚠️ 기존 프로필이 있는 사용자의 데이터를 덮어쓰지 않도록 보호
    // 먼저 AWS에 프로필이 존재하는지 확인한 후, 없을 때만 동의 정보 전송
    fetch(USER_API.PROFILE, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => (res.ok ? (res.json() as Promise<ProfileCheckResponse>) : null))
      .then((data) => {
        if (!data) return; // 조회 실패 시 안전하게 스킵

        // AWS 응답 구조 유연하게 처리 (플랫 또는 중첩 구조)
        const profile = data.profile || data;
        const alreadyDone =
          data.profileSetupDone || profile.profileSetupDone || profile.wellnessGoal;

        if (alreadyDone) {
          // 이미 완성된 프로필 → 동의 정보 전송 스킵
          return; // 이미 완성된 프로필이 있으면 덮어쓰지 않음
        }

        // 프로필 없음 → 신규 사용자이므로 동의 정보만 전송
        fetch(USER_API.PROFILE, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            termsConsent: consentData.termsConsent ?? true,
            termsConsentAt: consentData.termsConsentAt ?? new Date().toISOString(),
          }),
        }).catch((err) => console.warn("[sendPendingConsent] PUT failed:", err));
      })
      .catch((err) => console.warn("[sendPendingConsent] profile check failed:", err));
  } catch (err) {
    console.warn("[sendPendingConsent] unexpected error:", err);
  }
}

/** unknown 에러에서 메시지 추출 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

/** 비밀번호 유효성 검사 규칙 (회원가입 + 비밀번호 재설정 공용) */
export function getPwRules(pw: string) {
  return [
    { label: "8자 이상", pass: pw.length >= 8 },
    { label: "숫자 포함", pass: /\d/.test(pw) },
    { label: "영문 대문자 포함", pass: /[A-Z]/.test(pw) },
    { label: "특수문자 포함", pass: /[^A-Za-z0-9]/.test(pw) },
  ];
}

/** 로그인 후 리다이렉트 경로 결정 (기본 /home) */
export function getPostLoginRedirect(): string {
  const saved = getSession("redirect_after_login");
  if (saved) {
    removeSession("redirect_after_login");
    // Open Redirect 방지: 내부 경로만 허용
    if (saved.startsWith("/") && !saved.startsWith("//")) {
      return saved;
    }
  }

  // 프로필 설정 여부는 /home의 checkProfileSetup()이 판단
  // (localStorage → AWS fallback 체인으로 정확한 확인)
  // localStorage만으로는 새 기기/브라우저에서 오판할 수 있으므로
  // 로그인 페이지에서는 프로필 체크를 하지 않음
  return "/home";
}
