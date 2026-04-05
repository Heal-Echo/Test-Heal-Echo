"use client";

import styles from "./profile-setup.module.css";

// 성별 옵션
const GENDER_OPTIONS = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "선택하지 않음" },
];

interface ProfileStepFinalProps {
  nickname: string;
  setNickname: (v: string) => void;
  isNicknameEditing: boolean;
  setIsNicknameEditing: (v: boolean) => void;
  reportEmail: string;
  birthYear: string;
  setBirthYear: (v: string) => void;
  birthMonth: string;
  onBirthMonthChange: (v: string) => void;
  birthDay: string;
  setBirthDay: (v: string) => void;
  gender: string;
  setGender: (v: string) => void;
  pushNotification: boolean;
  setPushNotification: (v: boolean) => void;
  emailNotification: boolean;
  setEmailNotification: (v: boolean) => void;
  marketingConsent: boolean;
  setMarketingConsent: (v: boolean) => void;
  yearOptions: number[];
  monthOptions: number[];
  dayOptions: number[];
  isSaving: boolean;
  isStep5Valid: boolean;
  onBack: () => void;
  onComplete: () => void;
}

export default function ProfileStepFinal({
  nickname,
  setNickname,
  isNicknameEditing,
  setIsNicknameEditing,
  reportEmail,
  birthYear,
  setBirthYear,
  birthMonth,
  onBirthMonthChange,
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
  onBack,
  onComplete,
}: ProfileStepFinalProps) {
  return (
    <div className={styles.stepContent}>
      {/* 닉네임 카드 */}
      <div className={styles.card}>
        <label htmlFor="profile-nickname" className={styles.cardLabel}>
          힐에코에서 어떻게 불러드릴까요?
        </label>
        <div className={styles.inputWithButton}>
          <input
            id="profile-nickname"
            type="text"
            placeholder="닉네임을 입력해 주세요"
            className={`${styles.textInput} ${!isNicknameEditing ? styles.textInputDisabled : ""}`}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            disabled={!isNicknameEditing}
          />
          <button
            type="button"
            className={`${styles.editButton} ${isNicknameEditing ? styles.editButtonActive : ""}`}
            onClick={() => setIsNicknameEditing(!isNicknameEditing)}
            aria-label={isNicknameEditing ? "확인" : "수정"}
          >
            {isNicknameEditing ? (
              "확인"
            ) : (
              <svg width="22" height="22" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <polygon
                  points="14,50 50,14 56,20 20,56"
                  fill="#FFD93D"
                  stroke="#E6B800"
                  strokeWidth="1.5"
                />
                <polygon
                  points="50,14 56,20 62,8 56,2"
                  fill="#C19A6B"
                  stroke="#A67B5B"
                  strokeWidth="1"
                />
                <polygon points="56,2 62,8 63,5 60,2" fill="#4A4A4A" />
                <polygon
                  points="14,50 20,56 16,60 10,54"
                  fill="#C0C0C0"
                  stroke="#A0A0A0"
                  strokeWidth="1"
                />
                <polygon
                  points="10,54 16,60 12,64 6,58"
                  fill="#FF9FAB"
                  stroke="#E88894"
                  strokeWidth="1"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 이메일 카드 */}
      <div className={styles.card}>
        <label htmlFor="profile-email" className={styles.cardLabel}>
          주간 웰니스 리포트 수신 이메일
        </label>
        <input
          id="profile-email"
          type="email"
          className={`${styles.textInput} ${styles.textInputDisabled}`}
          value={reportEmail}
          disabled
        />
        <p className={styles.emailHint}>
          가입 이메일로 주간 ���니스 리포트가 발송됩니다. 변경이 필요하면 계정 설정에서 이메일을
          수정해 주세��.
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
              aria-label="출생 연도"
            >
              <option value="">년</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.selectWrapper}>
            <select
              className={styles.selectInput}
              value={birthMonth}
              aria-label="출생 월"
              onChange={(e) => onBirthMonthChange(e.target.value)}
            >
              <option value="">월</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.selectWrapper}>
            <select
              className={styles.selectInput}
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              aria-label="출생 일"
            >
              <option value="">일</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
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
              className={`${styles.chip} ${gender === opt.value ? styles.chipSelected : ""}`}
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
          <span className={styles.toggleDesc}>주간 웰니스 리포��, 프로그램 업데이트</span>
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
          힐에코의 오프라인 웰니스 소식, 할인 혜택 등 마��팅 정보를 받아보실 수 있습니다.
        </p>
      </div>

      <div className={styles.buttonRow}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          이전
        </button>
        <button
          type="button"
          className={styles.nextButton}
          onClick={onComplete}
          disabled={isSaving || !isStep5Valid}
        >
          {isSaving ? "저장 중..." : "시작하기"}
        </button>
      </div>
    </div>
  );
}
