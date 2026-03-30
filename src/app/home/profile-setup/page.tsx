"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./profileSetup.module.css";
import Header from "@/components/Header";
import { isUserLoggedIn, getUserName, getUserInfo } from "@/auth/user";
import { getProgramName } from "@/config/programs";
import * as storage from "@/lib/storage";

// ============================================================
// 프로필 설정 페이지 — 회원가입 후 온보딩 (5단계)
// Step 1: 어떤 케어가 필요하신가요? (선택 시 자동 이동)
// Step 2: 식습관에 신경 쓰는 편인가요? (선택 시 자동 이동)
// Step 3: 수면습관에 신경 쓰는 편인가요? (선택 시 자동 이동)
// Step 4: 요가나 명상 경험이 있으신가요? (선택 시 자동 이동)
// Step 5: 닉네임 + 이메일 + 생년월일/성별 + 알림/마케팅
// ============================================================

type Step = 1 | 2 | 3 | 4 | 5;

// 성별 옵션
const GENDER_OPTIONS = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "선택하지 않음" },
];

// 웰니스 목표 옵션
const GOAL_OPTIONS = [
  {
    value: "auto-balance",
    emoji: "🧘",
    title: "스트레스 해소, 긴장 완화, 수면 개선 등 자율신경의 균형 회복",
    subtitle: getProgramName("autobalance"),
  },
  {
    value: "womens-care",
    emoji: "🌸",
    title: "여성의 생애주기에 따른 몸과 마음의\n컨디션 관리",
    subtitle: getProgramName("womans-whisper"),
  },
];

// 식습관 옵션
const DIET_OPTIONS = [
  { value: "practicing", emoji: "🥗", label: "꾸준히 실천하고 있어요" },
  { value: "interested", emoji: "💭", label: "관심은 있지만 아직이에요" },
  { value: "not-yet", emoji: "😅", label: "아직 신경 쓰지 못했어요" },
];

// 수면습관 옵션
const SLEEP_OPTIONS = [
  { value: "practicing", emoji: "😴", label: "꾸준히 실천하고 있어요" },
  { value: "interested", emoji: "💭", label: "관심은 있지만 아직이에요" },
  { value: "not-yet", emoji: "🥱", label: "아직 신경 쓰지 못했어요" },
];

// 경험 수준 옵션
const EXPERIENCE_OPTIONS = [
  { value: "beginner", emoji: "🌱", label: "처음이에요", description: "요가나 명상을 해본 적이 없어요" },
  { value: "casual", emoji: "🌿", label: "가끔 해봤어요", description: "몇 번 시도해 본 적이 있어요" },
  { value: "regular", emoji: "🌳", label: "꾸준히 하고 있어요", description: "정기적으로 요가나 명상을 하고 있어요" },
];

export default function ProfileSetupPage() {
  const router = useRouter();

  // 🔐 보호 페이지: 로그인 여부 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }
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
  const [nicknameEditing, setNicknameEditing] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [gender, setGender] = useState("");
  const [pushNotification, setPushNotification] = useState(true);
  const [emailNotification, setEmailNotification] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // 기존 사용자 이름/이메일 + AWS 프로필 복원
  useEffect(() => {
    const name = getUserName();
    if (name) setNickname(name);

    const info = getUserInfo();
    if (info?.email) setReportEmail(info.email);

    // AWS에서 기존 프로필 불러오기 (이미 저장된 경우 복원)
    async function loadProfile() {
      try {
        const token = info?.idToken;
        if (!token) return;

        const res = await fetch("/api/user/profile", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.profile && data.profileSetupDone) {
          const p = data.profile;
          if (p.wellnessGoal) setWellnessGoal(p.wellnessGoal);
          if (p.dietHabit) setDietHabit(p.dietHabit);
          if (p.sleepHabit) setSleepHabit(p.sleepHabit);
          if (p.experience) setExperience(p.experience);
          if (p.nickname) setNickname(p.nickname);
          if (p.birthDate) {
            const parts = p.birthDate.split("-");
            if (parts.length === 3) {
              setBirthYear(parts[0]);
              setBirthMonth(String(Number(parts[1])));
              setBirthDay(String(Number(parts[2])));
            }
          }
          if (p.gender) setGender(p.gender);
          if (p.pushNotification !== undefined) setPushNotification(p.pushNotification);
          if (p.emailNotification !== undefined) setEmailNotification(p.emailNotification);
          if (p.marketingConsent !== undefined) setMarketingConsent(p.marketingConsent);
        }
      } catch (err) {
        console.warn("[Profile] AWS에서 프로필 로드 실패:", err);
      }
    }

    loadProfile();
  }, []);

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
  const [saving, setSaving] = useState(false);

  // 완료 (프로필 AWS 저장 + 스토리지 레이어 백업 + 홈으로 이동)
  async function handleComplete() {
    if (saving) return;
    setSaving(true);

    // 회원가입 시 임시 저장된 동의 기록 불러오기
    // ✅ storage 추상화 레이어 경유 — 앱 전환 시 AsyncStorage 등으로 자동 대응
    let consentData: Record<string, any> = {};
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
          console.log("[Profile] AWS 저장 성공");
          storage.remove("profile_aws_pending");
        }
      } else {
        // 토큰 없으면 pending 설정
        storage.set("profile_aws_pending", "true");
      }
    } catch (err) {
      console.warn("[Profile] AWS 저장 중 에러:", err);
      storage.set("profile_aws_pending", "true");
    }

    setSaving(false);
    router.replace("/home");
  }

  // 단계별 라벨
  const stepLabels = ["솔루션", "식습관", "수면", "경험", "프로필"];

  return (
    <div className={styles.container}>
      <Header />

      {/* 환영 메시지 + 진행 표시 */}
      <div className={styles.welcomeArea}>
        <p className={styles.welcomeText}>
          {step === 1 && <>어떤 웰니스 솔루션이 필요하신가요?</>}
          {step === 2 && <>식습관에 신경 쓰는 편인가요?</>}
          {step === 3 && <>수면습관에 신경 쓰는 편인가요?</>}
          {step === 4 && <>요가나 명상 경험이 있으신가요?</>}
          {step === 5 && <>거의 다 왔어요!</>}
        </p>
        <div className={styles.progressBar}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`${styles.progressStep} ${s <= step ? styles.progressStepDone : ""}`}>
              <div
                className={`${styles.progressDot} ${
                  s === step ? styles.progressDotActive : ""
                } ${s < step ? styles.progressDotDone : ""}`}
              >
                {s < step ? "✓" : s}
              </div>
              <span className={`${styles.progressLabel} ${
                s === step ? styles.progressLabelActive : ""
              }`}>
                {stepLabels[s - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className={styles.main}>

        {/* ===============================
            Step 1: 어떤 케어가 필요하신가요?
        =============================== */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.goalGroup}>
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.goalCard} ${
                    wellnessGoal === opt.value ? styles.goalCardSelected : ""
                  }`}
                  onClick={() => handleGoalSelect(opt.value)}
                >
                  <span className={styles.goalEmoji}>{opt.emoji}</span>
                  <div className={styles.goalTextWrap}>
                    <span className={styles.goalTitle}>{opt.title}</span>
                    <span className={styles.goalSubtitle}>{opt.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===============================
            Step 2: 식습관에 신경 쓰는 편인가요?
        =============================== */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.habitGroup}>
              {DIET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.habitCard} ${
                    dietHabit === opt.value ? styles.habitCardSelected : ""
                  }`}
                  onClick={() => handleDietSelect(opt.value)}
                >
                  <span className={styles.habitEmoji}>{opt.emoji}</span>
                  <span className={styles.habitLabel}>{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.backButtonStandalone}
              onClick={handleBack}
            >
              이전
            </button>
          </div>
        )}

        {/* ===============================
            Step 3: 수면습관에 신경 쓰는 편인가요?
        =============================== */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <div className={styles.habitGroup}>
              {SLEEP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.habitCard} ${
                    sleepHabit === opt.value ? styles.habitCardSelected : ""
                  }`}
                  onClick={() => handleSleepSelect(opt.value)}
                >
                  <span className={styles.habitEmoji}>{opt.emoji}</span>
                  <span className={styles.habitLabel}>{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.backButtonStandalone}
              onClick={handleBack}
            >
              이전
            </button>
          </div>
        )}

        {/* ===============================
            Step 4: 요가나 명상 경험
        =============================== */}
        {step === 4 && (
          <div className={styles.stepContent}>
            <div className={styles.experienceGroup}>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.experienceCard} ${
                    experience === opt.value ? styles.experienceCardSelected : ""
                  }`}
                  onClick={() => handleExperienceSelect(opt.value)}
                >
                  <span className={styles.experienceEmoji}>{opt.emoji}</span>
                  <div className={styles.experienceTextWrap}>
                    <span className={styles.experienceLabel}>{opt.label}</span>
                    <span className={styles.experienceDesc}>{opt.description}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.backButtonStandalone}
              onClick={handleBack}
            >
              이전
            </button>
          </div>
        )}

        {/* ===============================
            Step 5: 닉네임 + 이메일 + 생년월일/성별 + 알림/마케팅
        =============================== */}
        {step === 5 && (
          <div className={styles.stepContent}>

            {/* 닉네임 카드 */}
            <div className={styles.card}>
              <label className={styles.cardLabel}>힐에코에서 어떻게 불러드릴까요?</label>
              <div className={styles.inputWithButton}>
                <input
                  type="text"
                  placeholder="닉네임을 입력해 주세요"
                  className={`${styles.textInput} ${!nicknameEditing ? styles.textInputDisabled : ""}`}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  disabled={!nicknameEditing}
                />
                <button
                  type="button"
                  className={`${styles.editButton} ${nicknameEditing ? styles.editButtonActive : ""}`}
                  onClick={() => setNicknameEditing(!nicknameEditing)}
                  aria-label={nicknameEditing ? "확인" : "수정"}
                >
                  {nicknameEditing ? "확인" : (
                    <svg width="22" height="22" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="14,50 50,14 56,20 20,56" fill="#FFD93D" stroke="#E6B800" strokeWidth="1.5" />
                      <polygon points="50,14 56,20 62,8 56,2" fill="#C19A6B" stroke="#A67B5B" strokeWidth="1" />
                      <polygon points="56,2 62,8 63,5 60,2" fill="#4A4A4A" />
                      <polygon points="14,50 20,56 16,60 10,54" fill="#C0C0C0" stroke="#A0A0A0" strokeWidth="1" />
                      <polygon points="10,54 16,60 12,64 6,58" fill="#FF9FAB" stroke="#E88894" strokeWidth="1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 이메일 카드 */}
            <div className={styles.card}>
              <label className={styles.cardLabel}>주간 웰니스 리포트 수신 이메일</label>
              <input
                type="email"
                className={`${styles.textInput} ${styles.textInputDisabled}`}
                value={reportEmail}
                disabled
              />
              <p className={styles.emailHint}>
                가입 이메일로 주간 웰니스 리포트가 발송됩니다. 변경이 필요하면 계정 설정에서 이메일을 수정해 주세요.
              </p>
            </div>

            {/* 생년월일 + 성별 카드 */}
            <div className={styles.card}>
              <label className={styles.cardLabel}>생년월일</label>
              <div className={styles.dateRow}>
                <div className={styles.selectWrapper}>
                  <select
                    className={styles.selectInput}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                  >
                    <option value="">년</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.selectWrapper}>
                  <select
                    className={styles.selectInput}
                    value={birthMonth}
                    onChange={(e) => {
                      setBirthMonth(e.target.value);
                      const newMax = getDaysInMonth(Number(birthYear), Number(e.target.value));
                      if (Number(birthDay) > newMax) setBirthDay("");
                    }}
                  >
                    <option value="">월</option>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.selectWrapper}>
                  <select
                    className={styles.selectInput}
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                  >
                    <option value="">일</option>
                    {dayOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.cardDivider} />

              <label className={styles.cardLabel}>성별</label>
              <div className={styles.chipGroup}>
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.chip} ${
                      gender === opt.value ? styles.chipSelected : ""
                    }`}
                    onClick={() => setGender(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 알림 설정 + 마케팅 동의 카드 */}
            <div className={styles.card}>
              <label className={styles.cardLabel}>알림 설정</label>

              <label className={styles.toggleRow}>
                <span className={styles.toggleLabel}>푸시 알림</span>
                <span className={styles.toggleDesc}>운동 리마인더, 새로운 프로그램 알림</span>
                <button
                  type="button"
                  className={`${styles.toggle} ${pushNotification ? styles.toggleOn : ""}`}
                  onClick={() => setPushNotification(!pushNotification)}
                  aria-checked={pushNotification}
                  role="switch"
                >
                  <span className={styles.toggleKnob} />
                </button>
              </label>

              <label className={styles.toggleRow}>
                <span className={styles.toggleLabel}>이메일 알림</span>
                <span className={styles.toggleDesc}>주간 웰니스 리포트, 프로그램 업데이트</span>
                <button
                  type="button"
                  className={`${styles.toggle} ${emailNotification ? styles.toggleOn : ""}`}
                  onClick={() => setEmailNotification(!emailNotification)}
                  aria-checked={emailNotification}
                  role="switch"
                >
                  <span className={styles.toggleKnob} />
                </button>
              </label>

              <div className={styles.cardDivider} />

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  마케팅 정보 수신에 동의합니다 <span className={styles.optionalTag}>선택</span>
                </span>
              </label>
              <p className={styles.marketingHint}>
                힐에코의 오프라인 웰니스 소식, 할인 혜택 등 마케팅 정보를 받아보실 수 있습니다.
              </p>
            </div>

            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.backButton}
                onClick={handleBack}
              >
                이전
              </button>
              <button
                type="button"
                className={styles.nextButton}
                onClick={handleComplete}
                disabled={saving}
              >
                {saving ? "저장 중..." : "시작하기"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
