"use client";

import styles from "./profile-setup.module.css";
import Header from "@/components/Header";
import { useProfileSetup, STEP_LABELS } from "./use-profile-setup";
import ProfileStepSelect from "./profile-step-select";
import ProfileStepFinal from "./profile-step-final";

// ============================================================
// 프로필 설정 페이지 — 회원가입 후 온보딩 (5단계)
// Step 1: 어떤 케어가 필요하신가요? (선택 시 자동 이동)
// Step 2: 식습관에 신경 쓰는 편인가요? (선택 시 자동 이동)
// Step 3: 수면습관에 신경 쓰는 편인가요? (선택 시 자동 이동)
// Step 4: 요가나 명상 경험이 있으신가요? (선택 시 자동 이동)
// Step 5: 닉네임 + 이메일 + 생년월일/성별 + 알림/마케팅
// ============================================================

export default function ProfileSetupPage() {
  const {
    step,
    wellnessGoal,
    dietHabit,
    sleepHabit,
    experience,
    handleGoalSelect,
    handleDietSelect,
    handleSleepSelect,
    handleExperienceSelect,
    handleBack,
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
    isSaving,
    isStep5Valid,
    handleComplete,
  } = useProfileSetup();

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
                {STEP_LABELS[s - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className={styles.main}>
        {step <= 4 && (
          <ProfileStepSelect
            step={step}
            wellnessGoal={wellnessGoal}
            dietHabit={dietHabit}
            sleepHabit={sleepHabit}
            experience={experience}
            onGoalSelect={handleGoalSelect}
            onDietSelect={handleDietSelect}
            onSleepSelect={handleSleepSelect}
            onExperienceSelect={handleExperienceSelect}
            onBack={handleBack}
          />
        )}

        {step === 5 && (
          <ProfileStepFinal
            nickname={nickname}
            setNickname={setNickname}
            isNicknameEditing={isNicknameEditing}
            setIsNicknameEditing={setIsNicknameEditing}
            reportEmail={reportEmail}
            birthYear={birthYear}
            setBirthYear={setBirthYear}
            birthMonth={birthMonth}
            onBirthMonthChange={handleBirthMonthChange}
            birthDay={birthDay}
            setBirthDay={setBirthDay}
            gender={gender}
            setGender={setGender}
            pushNotification={pushNotification}
            setPushNotification={setPushNotification}
            emailNotification={emailNotification}
            setEmailNotification={setEmailNotification}
            marketingConsent={marketingConsent}
            setMarketingConsent={setMarketingConsent}
            yearOptions={yearOptions}
            monthOptions={monthOptions}
            dayOptions={dayOptions}
            isSaving={isSaving}
            isStep5Valid={isStep5Valid}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        )}
      </main>
    </div>
  );
}
