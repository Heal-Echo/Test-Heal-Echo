"use client";

import styles from "./profile-setup.module.css";
import { getProgramName } from "@/config/programs";
import type { Step } from "./use-profile-setup";

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
  {
    value: "beginner",
    emoji: "🌱",
    label: "처음이에요",
    description: "요가나 명상을 해본 적이 없어요",
  },
  {
    value: "casual",
    emoji: "🌿",
    label: "가끔 해봤어요",
    description: "몇 번 시도해 본 적이 있어요",
  },
  {
    value: "regular",
    emoji: "🌳",
    label: "꾸준히 하고 있어요",
    description: "정기적으로 요가나 명상을 하고 있어요",
  },
];

interface ProfileStepSelectProps {
  step: Step;
  wellnessGoal: string;
  dietHabit: string;
  sleepHabit: string;
  experience: string;
  onGoalSelect: (value: string) => void;
  onDietSelect: (value: string) => void;
  onSleepSelect: (value: string) => void;
  onExperienceSelect: (value: string) => void;
  onBack: () => void;
}

export default function ProfileStepSelect({
  step,
  wellnessGoal,
  dietHabit,
  sleepHabit,
  experience,
  onGoalSelect,
  onDietSelect,
  onSleepSelect,
  onExperienceSelect,
  onBack,
}: ProfileStepSelectProps) {
  if (step === 1) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.goalGroup}>
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.goalCard} ${
                wellnessGoal === opt.value ? styles.goalCardSelected : ""
              }`}
              onClick={() => onGoalSelect(opt.value)}
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
    );
  }

  if (step === 2) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.habitGroup}>
          {DIET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.habitCard} ${
                dietHabit === opt.value ? styles.habitCardSelected : ""
              }`}
              onClick={() => onDietSelect(opt.value)}
            >
              <span className={styles.habitEmoji}>{opt.emoji}</span>
              <span className={styles.habitLabel}>{opt.label}</span>
            </button>
          ))}
        </div>

        <button type="button" className={styles.backButtonStandalone} onClick={onBack}>
          이전
        </button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.habitGroup}>
          {SLEEP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.habitCard} ${
                sleepHabit === opt.value ? styles.habitCardSelected : ""
              }`}
              onClick={() => onSleepSelect(opt.value)}
            >
              <span className={styles.habitEmoji}>{opt.emoji}</span>
              <span className={styles.habitLabel}>{opt.label}</span>
            </button>
          ))}
        </div>

        <button type="button" className={styles.backButtonStandalone} onClick={onBack}>
          이전
        </button>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.experienceGroup}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.experienceCard} ${
                experience === opt.value ? styles.experienceCardSelected : ""
              }`}
              onClick={() => onExperienceSelect(opt.value)}
            >
              <span className={styles.experienceEmoji}>{opt.emoji}</span>
              <div className={styles.experienceTextWrap}>
                <span className={styles.experienceLabel}>{opt.label}</span>
                <span className={styles.experienceDesc}>{opt.description}</span>
              </div>
            </button>
          ))}
        </div>

        <button type="button" className={styles.backButtonStandalone} onClick={onBack}>
          이전
        </button>
      </div>
    );
  }

  return null;
}
