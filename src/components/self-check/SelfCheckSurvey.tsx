"use client";

import React, { useState, useMemo, useCallback } from "react";
import styles from "./SelfCheckSurvey.module.css";
import * as storage from "@/lib/storage";

// ─────────────────────────────────────────
// 설문 데이터: 6개 영역, 공감형 어조
// ─────────────────────────────────────────
type Symptom = {
  id: string;
  text: string;
};

type Category = {
  id: string;
  icon: string;
  title: string;
  empathy: string;
  color: string;
  symptoms: Symptom[];
};

const CATEGORIES: Category[] = [
  {
    id: "digestion",
    icon: "🍃",
    title: "소화와 식욕",
    empathy:
      "먹는 것조차 편하지 않다면,\n몸이 보내는 첫 번째 신호일 수 있어요.",
    color: "#f59e0b",
    symptoms: [
      { id: "d1", text: "기운이 없는데, 먹어도 소화가 안 돼서 더 힘들어요" },
      { id: "d2", text: "소화가 잘 안 되거나 배에 가스가 자주 차요" },
      { id: "d3", text: "변비나 설사가 반복돼요" },
      { id: "d4", text: "속이 울렁거리거나 메스꺼움을 느낄 때가 있어요" },
    ],
  },
  {
    id: "mind",
    icon: "🌀",
    title: "마음의 패턴",
    empathy:
      "혹시 '괜히 그랬나' 하는 생각이\n자주 머릿속을 맴돌지 않나요?",
    color: "#8b8b8b",
    symptoms: [
      { id: "m1", text: "작은 일에도 분석을 많이 하는 편이에요" },
      { id: "m2", text: "지나간 말이나 행동을 자꾸 되짚게 돼요" },
      { id: "m3", text: "결정을 내릴 때 에너지가 많이 소모돼요" },
      { id: "m4", text: "나에게 기준이 높고, 못 미치면 자책해요" },
      { id: "m5", text: "'더 잘해야 해'라는 압박이 늘 있어요" },
    ],
  },
  {
    id: "emotion",
    icon: "💧",
    title: "감정과 관계",
    empathy:
      "아무렇지 않은 척하지만,\n사실 마음이 많이 지쳐 있진 않나요?",
    color: "#ec4899",
    symptoms: [
      { id: "e1", text: "감정을 겉으로 잘 드러내지 않는 편이에요" },
      { id: "e2", text: "괜찮은 척하지만, 안에서는 감정이 끓어오를 때가 있어요" },
      { id: "e3", text: "타인의 말과 표정, 반응에 많이 신경이 쓰여요" },
      { id: "e4", text: "쉬어도 쉬는 것 같지 않고, 몸에 늘 힘이 들어가 있어요" },
      { id: "e5", text: "아무 것도 안 하고 있으면 괜히 죄책감이 들거나 불안해요" },
    ],
  },
  {
    id: "sleep",
    icon: "🌙",
    title: "수면과 에너지",
    empathy:
      "충분히 잤는데도 피곤하다면,\n그건 잠의 문제가 아닐 수 있어요.",
    color: "#f97316",
    symptoms: [
      { id: "s1", text: "잠들기 어렵거나, 자면서도 자주 깨요" },
      { id: "s2", text: "누워도 머릿속 생각이 멈추지 않아요" },
      { id: "s3", text: "충분히 자도 피로가 회복되지 않아요" },
      { id: "s4", text: "낮에도 졸리거나 극심한 피로를 느껴요" },
    ],
  },
  {
    id: "body",
    icon: "⚡",
    title: "몸의 신호",
    empathy:
      "검사에서는 정상이래는데,\n몸은 분명히 뭔가 다르다고 말하고 있나요?",
    color: "#ef4444",
    symptoms: [
      { id: "b1", text: "긴장 상태에서 두통, 위장 장애, 근육 통증이 자주 와요" },
      { id: "b3", text: "손발이 너무 차갑거나 뜨겁게 느껴져요" },
      { id: "b4", text: "머리에 안개 낀 듯한 느낌이에요" },
      { id: "b5", text: "갑자기 숨이 막히거나 깊게 숨쉬고 싶을 때가 있어요" },
      { id: "b6", text: "작은 소리나 촉감에 민감하게 반응해요" },
      { id: "b8", text: "갑자기 일어날 때 어지러움을 자주 느껴요" },
    ],
  },
  {
    id: "lifestyle",
    icon: "🪴",
    title: "생활과 환경",
    empathy:
      "매일의 작은 습관과 환경도\n자율신경의 균형에 영향을 줄 수 있어요.",
    color: "#22c55e",
    symptoms: [
      { id: "l1", text: "오래 앉아 있는 생활 습관이 있어요" },
      { id: "l2", text: "어깨가 안으로 말리고 등이 구부정해요" },
      { id: "l3", text: "과도한 스트레스가 '나도 모르게' 누적된 것 같아요" },
      { id: "l4", text: "면역력이 이전보다 약해진 느낌이에요" },
      { id: "l5", text: "컨디션이 안 좋은데 병원 검사는 모두 정상이에요" },
    ],
  },
];

const FREQUENCIES = [
  { id: "sometimes", label: "가끔", score: 1 },
  { id: "often", label: "자주", score: 2 },
  { id: "almost_daily", label: "거의 매일", score: 3 },
] as const;

type FrequencyId = (typeof FREQUENCIES)[number]["id"];

// ─────────────────────────────────────────
// 불균형 신호 강도 (Signal Intensity Framing)
// 높을수록 주의 — 영향받은 영역만 계산하여 희석 방지
// ─────────────────────────────────────────

/** 카테고리 결과 배열 → 불균형 신호 강도 (0~100%) */
export function getSignalIntensity(
  categories: { percent: number }[]
): number {
  const affected = categories.filter((c) => c.percent > 0);
  if (affected.length === 0) return 0;
  // 영향받은 영역만의 평균 + 영역 확산 보정 (3개 이상이면 가중)
  const avg = affected.reduce((s, c) => s + c.percent, 0) / affected.length;
  const spreadBonus = affected.length >= 3
    ? Math.min(15, (affected.length - 2) * 5)
    : 0;
  return Math.min(100, Math.round(avg + spreadBonus));
}

/** 신호 강도 → 등급 + 라벨 + 색상 (높을수록 위험) */
export function getSignalGrade(intensity: number): {
  grade: string;
  label: string;
  shortLabel: string;
  color: string;
} {
  if (intensity === 0)
    return { grade: "S", label: "신호 없음", shortLabel: "균형이 잘 유지되고 있어요", color: "#059669" };
  if (intensity <= 20)
    return { grade: "A", label: "약한 신호", shortLabel: "가벼운 신호가 감지되고 있어요", color: "#10b981" };
  if (intensity <= 40)
    return { grade: "B", label: "보통 신호", shortLabel: "몸이 보내는 신호에 귀 기울여 주세요", color: "#f59e0b" };
  if (intensity <= 60)
    return { grade: "C", label: "주의 신호", shortLabel: "자율신경이 균형을 잃어가고 있어요", color: "#f97316" };
  if (intensity <= 80)
    return { grade: "D", label: "강한 신호", shortLabel: "적극적인 균형 회복이 필요해요", color: "#ef4444" };
  return { grade: "F", label: "매우 강한 신호", shortLabel: "지금 바로 시작하는 게 중요해요", color: "#dc2626" };
}

/** 신호 강도별 동기부여 문구 (결손 프레이밍) */
function getSignalMotivation(intensity: number, affectedCount: number): string {
  if (intensity === 0)
    return "균형이 잘 유지되고 있어요.\n이 좋은 컨디션을 더 단단하게 만들어 볼까요?";
  if (intensity <= 20)
    return `${affectedCount}개 영역에서 가벼운 신호가 감지되었어요.\n지금이 가장 쉽게 균형을 되찾을 수 있는 시점이에요.`;
  if (intensity <= 40)
    return `${affectedCount}개 영역에서 몸이 신호를 보내고 있어요.\n하루 15분 실천이 이 신호를 줄여줄 수 있어요.`;
  if (intensity <= 60)
    return `${affectedCount}개 영역에서 주의 신호가 감지되었어요.\n지금 시작하면 충분히 균형을 되찾을 수 있습니다.`;
  if (intensity <= 80)
    return `${affectedCount}개 영역에서 강한 불균형 신호가 감지되었어요.\n다음 세션이 회복의 시작점이 될 수 있어요.`;
  return `${affectedCount}개 영역에서 매우 강한 신호가 감지되었어요.\n몸이 보내는 신호에 지금 응답해 주세요.`;
}

type Answer = {
  symptomId: string;
  frequency: FrequencyId;
};

export type SelfCheckResult = {
  answers: Answer[];
  categories: {
    id: string;
    title: string;
    icon: string;
    color: string;
    percent: number;
    selectedCount: number;
    totalCount: number;
  }[];
  affectedCategories: number;
  totalSelected: number;
  overallPercent: number;
  timestamp: number;
};

// ─────────────────────────────────────────
// 저장/조회 헬퍼 (storage 추상화 레이어 사용)
// - 키에 userId가 자동 포함되어 계정별 격리
// - 데이터 흐름: AWS 우선 조회 → 로컬은 캐시
// ─────────────────────────────────────────
const SELFCHECK_RESULT_KEY = "selfcheck_result";
const SELFCHECK_DONE_KEY = "selfcheck_done";
const SELFCHECK_AWS_PENDING_KEY = "selfcheck_aws_pending";

export function hasSelfCheckResult(): boolean {
  if (typeof window === "undefined") return false;
  try {
    storage.migrateKey(SELFCHECK_DONE_KEY);
    return storage.get(SELFCHECK_DONE_KEY) === "true";
  } catch {
    return false;
  }
}

export function getSavedSelfCheckResult(): SelfCheckResult | null {
  if (typeof window === "undefined") return null;
  try {
    storage.migrateKey(SELFCHECK_RESULT_KEY);
    return storage.getJSON<SelfCheckResult>(SELFCHECK_RESULT_KEY);
  } catch {}
  return null;
}

/**
 * AWS에 selfcheck 결과 POST — 성공 시 pending 플래그 제거, 실패 시 플래그 설정
 */
async function postSelfCheckToAWS(
  result: SelfCheckResult,
  token: string | null
): Promise<boolean> {
  try {
    const res = await fetch("/api/user/selfcheck-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(result),
    });
    if (res.ok) {
      storage.remove(SELFCHECK_AWS_PENDING_KEY);
      return true;
    }
    console.error("[SelfCheck] AWS 저장 실패:", res.status);
    return false;
  } catch (err) {
    console.error("[SelfCheck] AWS 저장 에러:", err);
    return false;
  }
}

async function saveSelfCheckResult(result: SelfCheckResult) {
  // 1) 로컬 캐시 저장 (즉시)
  storage.setJSON(SELFCHECK_RESULT_KEY, result);
  storage.set(SELFCHECK_DONE_KEY, "true");

  // 2) AWS 저장 (실패 시 pending 플래그 설정)
  const token = storage.getRaw("user_id_token");
  const ok = await postSelfCheckToAWS(result, token);
  if (!ok) {
    storage.set(SELFCHECK_AWS_PENDING_KEY, "true");
    console.warn(
      "[SelfCheck] AWS 저장 실패 — 다음 접속 시 재시도됩니다."
    );
  }
}

/**
 * selfcheck pending 데이터 재전송 (앱 복귀 / 인터넷 복구 시 호출)
 * - Home 페이지의 retryPendingProfileSync() 패턴과 동일
 * - pending 플래그가 있고 로컬에 결과가 있으면 서버에 재전송
 */
export async function retryPendingSelfCheckSync(): Promise<void> {
  if (typeof window === "undefined") return;

  const pending = storage.get(SELFCHECK_AWS_PENDING_KEY);
  if (pending !== "true") return;

  const local = getSavedSelfCheckResult();
  if (!local) return;

  const token = storage.getRaw("user_id_token");
  await postSelfCheckToAWS(local, token);
}

/**
 * 서버 우선 조회(Server-First) → 로컬 캐시 갱신
 * + 로컬에 AWS 미전송(pending) 데이터가 있으면 자동 재업로드
 */
export async function fetchAndHydrateSelfCheckResult(): Promise<SelfCheckResult | null> {
  const token = storage.getRaw("user_id_token");

  // 기존 키 → 사용자별 키 마이그레이션 (최초 1회, 이후 no-op)
  storage.migrateKey(SELFCHECK_RESULT_KEY);
  storage.migrateKey(SELFCHECK_DONE_KEY);
  storage.migrateKey(SELFCHECK_AWS_PENDING_KEY);

  const local = getSavedSelfCheckResult();

  // ── 재시도 로직: 로컬에 데이터 + AWS pending 플래그 ──
  if (local && storage.get(SELFCHECK_AWS_PENDING_KEY) === "true") {
    console.log("[SelfCheck] AWS 미전송 데이터 감지 — 재업로드 시도");
    await postSelfCheckToAWS(local, token);
    return local;
  }

  // ── AWS 우선 조회 ──
  try {
    const res = await fetch("/api/user/selfcheck-result", {
      method: "GET",
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.ok) {
      const json = await res.json();
      const results = json.results || json.items || [];

      if (Array.isArray(results) && results.length > 0) {
        // AWS에 데이터 있음 → 로컬 캐시 갱신
        const latest = results[results.length - 1] as SelfCheckResult;
        storage.setJSON(SELFCHECK_RESULT_KEY, latest);
        storage.set(SELFCHECK_DONE_KEY, "true");
        return latest;
      }

      // AWS에 데이터 없음 → 로컬 캐시도 정리 (다른 계정의 잔존 데이터 방지)
      if (local) {
        storage.remove(SELFCHECK_RESULT_KEY);
        storage.remove(SELFCHECK_DONE_KEY);
      }
      return null;
    }
  } catch (err) {
    console.error("[SelfCheck] 서버 결과 조회 실패:", err);
  }

  // ── AWS 조회 실패 시 로컬 캐시 폴백 (오프라인 등) ──
  return local;
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
type Props = {
  /** 건너뛰기 클릭 시 */
  onSkip: () => void;
  /** 무료 체험 CTA 클릭 시 */
  onStartTrial: () => void;
  /** "영상 먼저 보기" CTA 클릭 시 */
  onWatchFirst: () => void;
  /** 인트로 없이 바로 질문부터 시작 (영상 후 재제안 시) */
  skipIntro?: boolean;
  /** 결과 화면 Primary CTA 텍스트 (기본: "7일 무료 체험 시작하기") */
  primaryCtaText?: string;
  /** 결과 화면 Secondary CTA 텍스트 (기본: "먼저 영상 보고 결정할게요") */
  secondaryCtaText?: string;
};

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────
export default function SelfCheckSurvey({
  onSkip,
  onStartTrial,
  onWatchFirst,
  skipIntro = false,
  primaryCtaText = "7일 무료 체험 시작하기",
  secondaryCtaText = "먼저 영상 보고 결정할게요",
}: Props) {
  const [step, setStep] = useState<"intro" | number | "result">(
    skipIntro ? 0 : "intro"
  );
  const [answers, setAnswers] = useState<Answer[]>([]);

  // ── 증상 선택 토글 ──
  const toggleSymptom = useCallback((symptomId: string) => {
    setAnswers((prev) => {
      const exists = prev.find((a) => a.symptomId === symptomId);
      if (exists) {
        return prev.filter((a) => a.symptomId !== symptomId);
      }
      return [...prev, { symptomId, frequency: "sometimes" }];
    });
  }, []);

  // ── 빈도 변경 ──
  const setFrequency = useCallback(
    (symptomId: string, frequency: FrequencyId) => {
      setAnswers((prev) =>
        prev.map((a) => (a.symptomId === symptomId ? { ...a, frequency } : a))
      );
    },
    []
  );

  // ── 결과 계산 ──
  const results = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catSymptomIds = new Set(cat.symptoms.map((s) => s.id));
      const catAnswers = answers.filter((a) => catSymptomIds.has(a.symptomId));
      const maxScore = cat.symptoms.length * 3;
      const rawScore = catAnswers.reduce((sum, a) => {
        const freq = FREQUENCIES.find((f) => f.id === a.frequency);
        return sum + (freq?.score || 1);
      }, 0);
      const percent = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;

      return {
        id: cat.id,
        icon: cat.icon,
        title: cat.title,
        color: cat.color,
        selectedCount: catAnswers.length,
        totalCount: cat.symptoms.length,
        percent,
      };
    });
  }, [answers]);

  const affectedCategories = results.filter((r) => r.percent > 0).length;
  const totalSelected = answers.length;
  const overallPercent =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length)
      : 0;

  // 결과 저장 + 콜백
  const handleShowResult = useCallback(async () => {
    const result: SelfCheckResult = {
      answers,
      categories: results,
      affectedCategories,
      totalSelected,
      overallPercent,
      timestamp: Date.now(),
    };
    setStep("result");
    await saveSelfCheckResult(result);
  }, [answers, results, affectedCategories, totalSelected, overallPercent]);

  // ── 렌더링 ──
  const currentCatIndex = typeof step === "number" ? step : -1;
  const currentCat = currentCatIndex >= 0 ? CATEGORIES[currentCatIndex] : null;

  return (
    <div className={styles.main}>
      {/* ── 프로그레스 + 건너뛰기 (질문 화면에서만) ── */}
      {typeof step === "number" && (
        <div className={styles.topBar}>
          <div className={styles.progressDots}>
            {CATEGORIES.map((cat, i) => (
              <div
                key={cat.id}
                className={`${styles.progressDot} ${
                  i === currentCatIndex
                    ? styles.progressDotActive
                    : i < currentCatIndex
                      ? styles.progressDotDone
                      : ""
                }`}
              />
            ))}
          </div>
          <button className={styles.skipBtn} onClick={onSkip}>
            건너뛰기
          </button>
        </div>
      )}

      {/* ── 인트로 화면 ── */}
      {step === "intro" && (
        <div className={styles.introScreen}>
          <div className={styles.introEmoji}>🔍</div>
          <h1 className={styles.introTitle}>
            혹시 나도?
            <br />
            1분 자가 체크
          </h1>
          <p className={styles.introSub}>
            다양한 증상이 사실은 하나의 원인에서
            <br />
            비롯될 수 있다는 걸 알고 계셨나요?
            <br />
            지금 나의 자율신경 균형 상태를 확인해 보세요.
          </p>
          <button
            className={styles.introStartBtn}
            onClick={() => setStep(0)}
          >
            시작하기
          </button>
          <button className={styles.introSkipBtn} onClick={onSkip}>
            영상부터 볼게요
          </button>
        </div>
      )}

      {/* ── 카테고리 질문 화면 ── */}
      {currentCat && (
        <div className={styles.questionScreen} key={currentCat.id}>
          <div className={styles.categoryIcon}>{currentCat.icon}</div>
          <h2 className={styles.categoryTitle}>{currentCat.title}</h2>
          <p className={styles.categoryEmpathy}>
            {currentCat.empathy.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < currentCat.empathy.split("\n").length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>

          <div className={styles.symptomList}>
            {currentCat.symptoms.map((symptom) => {
              const answer = answers.find((a) => a.symptomId === symptom.id);
              const isSelected = !!answer;

              return (
                <div key={symptom.id}>
                  <div
                    className={`${styles.symptomItem} ${
                      isSelected ? styles.symptomItemSelected : ""
                    }`}
                    onClick={() => toggleSymptom(symptom.id)}
                  >
                    <div
                      className={`${styles.symptomCheck} ${
                        isSelected ? styles.symptomCheckSelected : ""
                      }`}
                    >
                      {isSelected && (
                        <span className={styles.symptomCheckMark}>✓</span>
                      )}
                    </div>
                    <span className={styles.symptomText}>{symptom.text}</span>
                  </div>

                  {isSelected && (
                    <div className={styles.frequencyRow}>
                      {FREQUENCIES.map((f) => (
                        <button
                          key={f.id}
                          className={`${styles.frequencyBtn} ${
                            answer?.frequency === f.id
                              ? styles.frequencyBtnActive
                              : ""
                          }`}
                          onClick={() => setFrequency(symptom.id, f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 해당 카테고리에서 아무것도 선택하지 않은 경우 안내 */}
          {(() => {
            const catSymptomIds = new Set(currentCat.symptoms.map((s) => s.id));
            const hasAny = answers.some((a) => catSymptomIds.has(a.symptomId));
            return !hasAny ? (
              <p className={styles.noMatchHint}>
                해당사항이 없으면 그대로 다음으로 넘어가세요.
              </p>
            ) : null;
          })()}

          <div className={styles.navButtons}>
            {currentCatIndex > 0 && (
              <button
                className={styles.prevBtn}
                onClick={() => setStep(currentCatIndex - 1)}
              >
                이전
              </button>
            )}
            <button
              className={styles.nextBtn}
              onClick={() => {
                if (currentCatIndex < CATEGORIES.length - 1) {
                  setStep(currentCatIndex + 1);
                } else {
                  handleShowResult();
                }
              }}
            >
              {currentCatIndex < CATEGORIES.length - 1
                ? "다음"
                : "결과 확인하기"}
            </button>
          </div>
        </div>
      )}

      {/* ── 결과 화면 ── */}
      {step === "result" && (() => {
        const intensity = getSignalIntensity(results);
        const gradeInfo = getSignalGrade(intensity);
        const motivation = getSignalMotivation(intensity, affectedCategories);

        return (
          <div className={styles.resultScreen}>
            {/* 1단계: 불균형 신호 강도 */}
            <div className={styles.resultCard}>
              <h2 className={styles.resultCardTitle}>불균형 신호 강도</h2>

              <div className={styles.scoreCircle} style={{ borderColor: gradeInfo.color }}>
                <span className={styles.scoreNumber} style={{ color: gradeInfo.color }}>
                  {intensity}
                </span>
                <span className={styles.scoreUnit} style={{ color: gradeInfo.color }}>%</span>
              </div>

              <div className={styles.gradeRow}>
                <span className={styles.gradeBadge} style={{ background: gradeInfo.color }}>
                  {gradeInfo.grade}
                </span>
                <span className={styles.gradeLabel} style={{ background: gradeInfo.color }}>
                  {gradeInfo.shortLabel}
                </span>
              </div>

              <p className={styles.motivationText}>
                {motivation.split("\n").map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                  </React.Fragment>
                ))}
              </p>
            </div>

            {/* 상세 영역 레포트 (PSQI componentGrid 패턴) */}
            <details className={styles.detailToggle}>
              <summary className={styles.detailSummary}>영역별 상세 보기</summary>
              <div className={styles.detailContent}>
                <div className={styles.detailScoreRow}>
                  <span className={styles.detailScoreLabel}>불균형 신호 강도</span>
                  <span className={styles.detailScoreValue}>
                    {intensity}
                    <span className={styles.detailScoreMax}>%</span>
                  </span>
                </div>
                <div className={styles.componentGrid}>
                  {results.map((r) => (
                    <div key={r.id} className={styles.componentItem}>
                      <div className={styles.componentLeft}>
                        <span className={styles.componentIcon}>{r.icon}</span>
                        <span className={styles.componentName}>{r.title}</span>
                      </div>
                      <span className={styles.componentScore}>
                        {r.selectedCount}
                        <span className={styles.componentMax}>/{r.totalCount}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            {/* 인사이트 + 희망 메시지 */}
            <div className={styles.insightCard}>
              <p className={styles.insightText}>
                {affectedCategories}개 영역에서 불균형 신호가 감지되었어요.
                {affectedCategories >= 3
                  ? " 여러 영역에 걸친 증상은 자율신경이라는 하나의 뿌리에서 비롯될 수 있어요."
                  : " 지금 느끼는 불편함의 원인을 자율신경 균형에서 찾아볼 수 있어요."}
              </p>
            </div>

            <div className={styles.hopeCard}>
              <div className={styles.hopeEmoji}>🌿</div>
              <p className={styles.hopeText}>
                자율신경의 균형은 회복될 수 있어요.
                <br />
                하루 15분, 꾸준한 실천으로
                <br />
                많은 분들이 변화를 경험하고 있어요.
              </p>
            </div>

            <div className={styles.resultCta}>
              <button className={styles.ctaPrimaryBtn} onClick={onStartTrial}>
                {primaryCtaText}
              </button>
              <button className={styles.ctaSecondaryBtn} onClick={onWatchFirst}>
                {secondaryCtaText}
              </button>
            </div>

            <p className={styles.disclaimer}>
              이 체크리스트는 의학적 진단이 아니며,
              <br />
              자가 인식을 위한 참고 자료입니다.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
