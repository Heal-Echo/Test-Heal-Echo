"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn, getUserName, getUserInfo } from "@/auth/user";
import * as storage from "@/lib/storage";

// ============================================================
// 프로필 설정 — 비즈니스 로직 훅
// ============================================================

export type Step = 1 | 2 | 3 | 4 | 5;

/** API GET /api/user/profile 응답 타입 */
interface ProfileResponse {
  profileSetupDone?: boolean;
  profile?: ProfileData;
  wellnessGoal?: string;
  dietHabit?: string;
  sleepHabit?: string;
  experience?: string;
  nickname?: string;
  birthDate?: string;
  gender?: string;
  pushNotification?: boolean;
  emailNotification?: boolean;
  marketingConsent?: boolean;
}

interface ProfileData {
  profileSetupDone?: boolean;
  wellnessGoal?: string;
  dietHabit?: string;
  sleepHabit?: string;
  experience?: string;
  nickname?: string;
  birthDate?: string;
  gender?: string;
  pushNotification?: boolean;
  emailNotification?: boolean;
  marketingConsent?: boolean;
}

export const STEP_LABELS = ["솔루션", "식습관", "수면", "경험", "프로필"];

export function useProfileSetup() {
  const router = useRouter();

  // 🔐 보호 페이지: 로그인 확인 + 기존 사용자 이름/이메일 설정 + AWS 프로필 확인
  // 단일 useEffect에서 API를 1회만 호출하여 중복 요청 방지
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    // 기존 사용자 이름/이메일을 JWT에서 가져와 폼 초기값 설정
    const name = getUserName();
    if (name) setNickname(name);
    const info = getUserInfo();
    if (info?.email) setReportEmail(info.email);

    // 이미 프로필 설정을 완료한 사용자는 다시 작성하지 않도록 홈으로 이동
    const profileDone = storage.get("profile_setup_done");
    if (profileDone) {
      router.replace("/home");
      return;
    }

    // 스토리지에 없으면 AWS에서 확인 (다른 기기/브라우저 캐시 삭제 대응)
    async function loadAndCheckProfile() {
      try {
        const token = info?.idToken;
        if (!token) return;

        const res = await fetch("/api/user/profile", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data: ProfileResponse = await res.json();
        // AWS 응답 구조 유연하게 처리 (플랫 또는 중첩 구조 모두 대응)
        const profile = data.profile || data;
        const isSetupDone = data.profileSetupDone || profile.profileSetupDone;

        if (isSetupDone && profile.wellnessGoal) {
          // AWS에 완료된 프로필 존재 → 스토리지 복원 후 홈으로 이동
          storage.setJSON("user_profile", profile);
          storage.set("profile_setup_done", "true");
          router.replace("/home");
        }
      } catch (err) {
        console.warn("[Profile] AWS 프로필 확인 실패:", err);
      }
    }

    loadAndCheckProfile();
  }, [router]);

  // 단계
  const [step, setStep] = useState<Step>(1);

  // Step 1: 케어 선택
  const [wellnessGoal, setWellnessGoal] = useState("");

  // Step 2: 식습관
  const [dietHabit, setDietHabit] = useState("");

  // Step 3: 수면습관
  const [sleepHabit, setSleepHabit] = useState("");

  // Step 4: 경험
  const [experience, setExperience] = useState("");

  // Step 5: 닉네임 + 이메일 + 생년월일/성별 + 알림/마케팅
  const [nickname, setNickname] = useState("");
  const [isNicknameEditing, setIsNicknameEditing] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState("");
  const [pushNotification, setPushNotification] = useState(true);
  const [emailNotification, setEmailNotification] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // 연도 옵션 생성 (1940 ~ 현재년도)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  function getDaysInMonth(year: number, month: number) {
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
  }
  const maxDay = getDaysInMonth(Number(birthYear), Number(birthMonth));
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  // 자동 이동 함수 (선택 후 짧은 딜레이 뒤 다음 페이지)
  function autoAdvance(nextStep: Step) {
    setTimeout(() => {
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 350);
  }

  // Step 1~4: 선택 시 자동 이동
  function handleGoalSelect(value: string) {
    setWellnessGoal(value);
    autoAdvance(2);
  }

  function handleDietSelect(value: string) {
    setDietHabit(value);
    autoAdvance(3);
  }

  function handleSleepSelect(value: string) {
    setSleepHabit(value);
    autoAdvance(4);
  }

  function handleExperienceSelect(value: string) {
    setExperience(value);
    autoAdvance(5);
  }

  // 이전 단계
  function handleBack() {
    if (step > 1) {
      setStep((step - 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // 저장 중 상태
  const [isSaving, setIsSaving] = useState(false);

  // 완료 (프로필 AWS 저장 + 스토리지 레이어 백업 + 홈으로 이동)
  const isStep5Valid = nickname.trim().length > 0;

  async function handleComplete() {
    if (isSaving || !isStep5Valid) return;
    setIsSaving(true);

    // 회원가입 시 임시 저장된 동의 기록 불러오기
    let consentData: {
      marketingConsent?: boolean;
      termsConsent?: boolean;
      termsConsentAt?: string;
      marketingConsentAt?: string | null;
    } = {};
    try {
      const pending = storage.getRaw("pending_consent");
      if (pending) {
        consentData = JSON.parse(pending);
        storage.removeRaw("pending_consent");
      }
    } catch {}

    const profile = {
      wellnessGoal,
      dietHabit: dietHabit || null,
      sleepHabit: sleepHabit || null,
      experience: experience || "not_selected",
      nickname: nickname.trim(),
      reportEmail: reportEmail.trim(),
      birthDate: birthYear && birthMonth && birthDay
        ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
        : null,
      gender: gender || null,
      pushNotification,
      emailNotification,
      marketingConsent: consentData.marketingConsent ?? marketingConsent,
      termsConsent: consentData.termsConsent ?? true,
      termsConsentAt: consentData.termsConsentAt ?? new Date().toISOString(),
      marketingConsentAt: consentData.marketingConsentAt ?? null,
      profileSetupDone: true,
    };

    // 스토리지 레이어에 백업 (오프라인/에러 fallback, userId 자동 포함)
    storage.setJSON("user_profile", { ...profile, completedAt: new Date().toISOString() });
    storage.set("profile_setup_done", "true");

    // AWS API에 프로필 저장 (결과 확인 + 실패 시 pending 플래그)
    try {
      const info = getUserInfo();
      const token = info?.idToken;

      if (token) {
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profile),
        });

        if (!res.ok) {
          console.warn("[Profile] AWS 저장 실패:", res.status);
          storage.set("profile_aws_pending", "true");
        } else {
          storage.remove("profile_aws_pending");
        }
      } else {
        storage.set("profile_aws_pending", "true");
      }
    } catch (err) {
      console.warn("[Profile] AWS 저장 중 에러:", err);
      storage.set("profile_aws_pending", "true");
    }

    setIsSaving(false);
    router.replace("/home");
  }

  // 생년월일 월 변경 시 일 보정
  function handleBirthMonthChange(value: string) {
    setBirthMonth(value);
    const newMax = getDaysInMonth(Number(birthYear), Number(value));
    if (Number(birthDay) > newMax) setBirthDay("");
  }

  return {
    // 단계
    step,
    // Step 1~4 선택값 + 핸들러
    wellnessGoal,
    dietHabit,
    sleepHabit,
    experience,
    handleGoalSelect,
    handleDietSelect,
    handleSleepSelect,
    handleExperienceSelect,
    handleBack,
    // Step 5 폼 상태
    nickname,
    setNickname,
    isNicknameEditing,
    setIsNicknameEditing,
    reportEmail,
    birthYear,
    setBirthYear,
    birthMonth,
    handleBirthMonthChange,
    birthDay,
    setBirthDay,
    gender,
    setGender,
    pushNotification,
    setPushNotification,
    emailNotification,
    setEmailNotification,
    marketingConsent,
    setMarketingConsent,
    yearOptions,
    monthOptions,
    dayOptions,
    // 완료
    isSaving,
    isStep5Valid,
    handleComplete,
  };
}
