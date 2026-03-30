"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./mypage.module.css";

// 사용자 인증 모듈
import { isUserLoggedIn, userLogout } from "@/auth/user";

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

// localStorage 키 (마이그레이션 소스)
const PLAY_DATES_KEY = "understanding_play_dates";
const HABIT_CHECK_DATES_KEY = "weekly_habit_check_dates";
const PRACTICE_MIGRATED_KEY = "practice_records_migrated";

// ─────────────────────────────────────────
// PSQI 결과 타입
// ─────────────────────────────────────────
type PSQIResult = {
  testDate: string; // "YYYY-MM-DD" 또는 ISO string
  total: number;    // 0~21
  components: Record<string, number>;
  efficiency: number;
};

function getPSQIQualityLabel(total: number): { label: string; color: string; grade: string } {
  if (total <= 2) return { label: "최상", color: "#059669", grade: "S" };
  if (total <= 5) return { label: "양호", color: "#10b981", grade: "A" };
  if (total <= 7) return { label: "보통", color: "#f59e0b", grade: "B" };
  if (total <= 10) return { label: "미흡", color: "#f97316", grade: "C" };
  if (total <= 15) return { label: "불량", color: "#ef4444", grade: "D" };
  return { label: "매우 불량", color: "#dc2626", grade: "F" };
}

/** 이상적 수면까지 남은 개선 점수 */
function getGapScore(total: number): number {
  return Math.round((10 - toScore10(total)) * 10) / 10;
}

/** PSQI 원점수(0~21)를 10점 만점 비선형 역환산 (높을수록 좋음, 지수 1.6 하향 압축) */
function toScore10(total: number): number {
  return Math.round(Math.pow(1 - total / 21, 1.6) * 100) / 10;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─────────────────────────────────────────
// 자율신경 밸런스 자가 체크 결과 타입 및 유틸
// ─────────────────────────────────────────
type SelfCheckCategory = {
  id: string;
  title: string;
  icon: string;
  color: string;
  percent: number;
  selectedCount: number;
  totalCount: number;
};

type SelfCheckResultItem = {
  testDate: string;
  answers: { symptomId: string; frequency: string }[];
  categories: SelfCheckCategory[];
  affectedCategories: number;
  totalSelected: number;
  overallPercent: number;
  createdAt?: string;
};

/** 카테고리 결과 배열 → 불균형 신호 강도 (0~100%) — SelfCheckSurvey.tsx와 동일 로직 */
function getSignalIntensity(categories: { percent: number }[]): number {
  const affected = categories.filter((c) => c.percent > 0);
  if (affected.length === 0) return 0;
  const avg = affected.reduce((s, c) => s + c.percent, 0) / affected.length;
  const spreadBonus = affected.length >= 3
    ? Math.min(15, (affected.length - 2) * 5)
    : 0;
  return Math.min(100, Math.round(avg + spreadBonus));
}

/** 신호 강도 → 등급 + 라벨 + 색상 (높을수록 주의) — SelfCheckSurvey.tsx와 동일 로직 */
function getSignalGrade(intensity: number): {
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

// ─────────────────────────────────────────
// 달력 유틸
// ─────────────────────────────────────────
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** localStorage에서 마이그레이션되지 않은 실천 기록을 읽어 AWS로 전송한 후 localStorage 정리 */
async function migrateLocalStorageToAWS(
  awsSolution: Set<string>,
  awsHabit: Set<string>,
  awsUnderstanding: Set<string>,
) {
  // ✅ Phase 9: 기존 non-scoped 플래그를 userId 키로 이전 + storage 레이어로 전환
  storage.migrateKey(PRACTICE_MIGRATED_KEY);
  if (storage.get(PRACTICE_MIGRATED_KEY) === "done") return;

  const toMigrate: { type: string; date: string }[] = [];

  // 위클리 해빗: localStorage에만 있는 날짜 (old non-scoped key → getRaw)
  try {
    const raw = storage.getRaw(HABIT_CHECK_DATES_KEY);
    if (raw) {
      const dates: string[] = JSON.parse(raw);
      for (const d of dates) {
        if (!awsHabit.has(d)) toMigrate.push({ type: "habit", date: d });
      }
    }
  } catch {}

  // 이해의 바다: localStorage에만 있는 날짜 (old non-scoped key → getRaw)
  try {
    const raw = storage.getRaw(PLAY_DATES_KEY);
    if (raw) {
      const dates: string[] = JSON.parse(raw);
      for (const d of dates) {
        if (!awsUnderstanding.has(d)) toMigrate.push({ type: "understanding", date: d });
      }
    }
  } catch {}

  // 웰니스 솔루션은 saveWatchRecord()가 호출된 적이 없어 기존 데이터 없음 — 스킵

  if (toMigrate.length === 0) {
    // 마이그레이션할 항목 없음 — 완료 표시만
    storage.set(PRACTICE_MIGRATED_KEY, "done");
    return;
  }

  // 병렬 전송
  const userToken = storage.getRaw("user_id_token");
  const results = await Promise.allSettled(
    toMigrate.map((item) =>
      fetch("/api/user/practice-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        },
        body: JSON.stringify(item),
      })
    )
  );

  // 안전장치: 모든 요청이 성공(fulfilled + response.ok)한 경우에만 완료 처리
  const allSucceeded = results.every(
    (r) => r.status === "fulfilled" && r.value.ok
  );

  if (allSucceeded) {
    // 마이그레이션 완료 표시 + localStorage 실천 기록 삭제
    storage.set(PRACTICE_MIGRATED_KEY, "done");
    storage.removeRaw(HABIT_CHECK_DATES_KEY);
    storage.removeRaw(PLAY_DATES_KEY);
  }
  // 실패 시: 아무것도 하지 않음 → 다음 방문 시 재시도
}

export default function MyPage() {
  const router = useRouter();

  // 🔐 로그인 여부만 검사
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 로그아웃 처리 (힐에코에서만 로그아웃 — 카카오 세션은 유지)
  const handleLogout = () => {
    try {
      userLogout();
    } catch (error) {
      console.error("User logout error", error);
    }

    // sessionStorage에 로그아웃 출처 기록 (로그인 페이지에서 뒤로가기 방지용)
    storage.setSession("logoutFrom", "mypage");

    // 강제 전체 페이지 이동 (replace로 현재 페이지를 히스토리에서 제거)
    window.location.replace("/public/landing");
    return; // 이후 코드 실행 차단
  };

  // ─────────────────────────────────────────
  // 달력 상태
  // ─────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [wellnessDates, setWellnessDates] = useState<Set<string>>(new Set());
  const [habitDates, setHabitDates] = useState<Set<string>>(new Set());
  const [playDates, setPlayDates] = useState<Set<string>>(new Set());

  // ─────────────────────────────────────────
  // PSQI 이력 상태 (서버 조회)
  // ─────────────────────────────────────────
  const [psqiResults, setPsqiResults] = useState<PSQIResult[]>([]);
  const [psqiLoading, setPsqiLoading] = useState(true);

  // ─────────────────────────────────────────
  // 자율신경 밸런스 자가 체크 이력 상태 (AWS 조회)
  // ─────────────────────────────────────────
  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckResultItem[]>([]);
  const [selfCheckLoading, setSelfCheckLoading] = useState(true);

  // 마운트 시 데이터 로드 (AWS API)
  useEffect(() => {
    async function fetchPracticeRecords() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/practice-record", {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          const items: { type: string; date: string }[] = data.items || [];

          const solutionSet = new Set<string>();
          const habitSet = new Set<string>();
          const understandingSet = new Set<string>();

          for (const item of items) {
            if (item.type === "solution") solutionSet.add(item.date);
            else if (item.type === "habit") habitSet.add(item.date);
            else if (item.type === "understanding") understandingSet.add(item.date);
          }

          // localStorage → AWS 마이그레이션 (1회만 실행)
          await migrateLocalStorageToAWS(solutionSet, habitSet, understandingSet);

          // 마이그레이션 후 최신 데이터 다시 조회
          const res2 = await fetch("/api/user/practice-record", {
            method: "GET",
            cache: "no-store",
            headers: {
              ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
            },
          });
          if (res2.ok) {
            const data2 = await res2.json();
            const items2: { type: string; date: string }[] = data2.items || [];
            const solSet = new Set<string>();
            const habSet = new Set<string>();
            const undSet = new Set<string>();
            for (const item of items2) {
              if (item.type === "solution") solSet.add(item.date);
              else if (item.type === "habit") habSet.add(item.date);
              else if (item.type === "understanding") undSet.add(item.date);
            }
            setWellnessDates(solSet);
            setHabitDates(habSet);
            setPlayDates(undSet);
          } else {
            setWellnessDates(solutionSet);
            setHabitDates(habitSet);
            setPlayDates(understandingSet);
          }
          return;
        }
      } catch (err) {
        console.error("실천 기록 API 조회 실패:", err);
      }
    }
    fetchPracticeRecords();

    // PSQI 결과 서버에서 조회
    async function fetchPSQI() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/psqi-result", {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          // API 응답이 배열이면 직접 사용, 아니면 items 또는 results 키 확인
          const items: PSQIResult[] = Array.isArray(data)
            ? data
            : data.items || data.results || [];
          // testDate 오름차순 정렬 (오래된 것 → 최신)
          items.sort((a: PSQIResult, b: PSQIResult) =>
            a.testDate.localeCompare(b.testDate)
          );
          setPsqiResults(items);
        }
      } catch (err) {
        console.error("PSQI 결과 조회 실패:", err);
      } finally {
        setPsqiLoading(false);
      }
    }
    fetchPSQI();

    // 자율신경 밸런스 자가 체크 결과 서버에서 조회
    async function fetchSelfCheck() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/selfcheck-result", {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          const items: SelfCheckResultItem[] = Array.isArray(data)
            ? data
            : data.items || data.results || [];
          // testDate 오름차순 정렬 (오래된 것 → 최신)
          items.sort((a: SelfCheckResultItem, b: SelfCheckResultItem) =>
            a.testDate.localeCompare(b.testDate)
          );
          setSelfCheckResults(items);
        }
      } catch (err) {
        console.error("자가 체크 결과 조회 실패:", err);
      } finally {
        setSelfCheckLoading(false);
      }
    }
    fetchSelfCheck();
  }, []);

  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const goToPrevMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  // 달력 그리드 데이터 계산
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  // 이번 달 실천 횟수
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const wellnessCountThisMonth = Array.from(wellnessDates).filter((d) =>
    d.startsWith(monthPrefix)
  ).length;
  const habitCountThisMonth = Array.from(habitDates).filter((d) =>
    d.startsWith(monthPrefix)
  ).length;
  const playCountThisMonth = Array.from(playDates).filter((d) =>
    d.startsWith(monthPrefix)
  ).length;

  // ─────────────────────────────────────────
  // PSQI 트렌드 계산
  // ─────────────────────────────────────────
  const latestPSQI = psqiResults.length > 0 ? psqiResults[psqiResults.length - 1] : null;
  const prevPSQI = psqiResults.length > 1 ? psqiResults[psqiResults.length - 2] : null;

  let trendDirection: "improved" | "same" | "worsened" | null = null;
  let trendDiff = 0;
  if (latestPSQI && prevPSQI) {
    trendDiff = latestPSQI.total - prevPSQI.total;
    if (trendDiff < 0) trendDirection = "improved";
    else if (trendDiff > 0) trendDirection = "worsened";
    else trendDirection = "same";
  }

  // SVG 트렌드 차트용 (최근 최대 6개)
  const chartData = psqiResults.slice(-6);
  const chartWidth = 280;
  const chartHeight = 80;
  const chartPadX = 24;
  const chartPadY = 12;
  const innerW = chartWidth - chartPadX * 2;
  const innerH = chartHeight - chartPadY * 2;

  // ─────────────────────────────────────────
  // 자율신경 밸런스 트렌드 계산
  // ─────────────────────────────────────────
  // 각 결과에서 신호 강도를 재계산
  const selfCheckWithIntensity = selfCheckResults.map((r) => ({
    ...r,
    intensity: getSignalIntensity(r.categories),
  }));

  const latestSC = selfCheckWithIntensity.length > 0
    ? selfCheckWithIntensity[selfCheckWithIntensity.length - 1]
    : null;
  const prevSC = selfCheckWithIntensity.length > 1
    ? selfCheckWithIntensity[selfCheckWithIntensity.length - 2]
    : null;

  let scTrendDirection: "improved" | "same" | "worsened" | null = null;
  if (latestSC && prevSC) {
    const diff = latestSC.intensity - prevSC.intensity;
    // 신호 강도는 낮을수록 좋음 → 감소 = 개선
    if (diff < 0) scTrendDirection = "improved";
    else if (diff > 0) scTrendDirection = "worsened";
    else scTrendDirection = "same";
  }

  // SVG 트렌드 차트용 (최근 최대 6개)
  const scChartData = selfCheckWithIntensity.slice(-6);
  const scChartWidth = 280;
  const scChartHeight = 80;
  const scChartPadX = 24;
  const scChartPadY = 12;
  const scInnerW = scChartWidth - scChartPadX * 2;
  const scInnerH = scChartHeight - scChartPadY * 2;

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* ── 설정 버튼 ── */}
        <div className={styles.settingsRow}>
          <button
            className={styles.settingsBtn}
            aria-label="설정"
            onClick={() => router.push("/mypage/settings")}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* ── 통합 실천 캘린더 ── */}
        <section className={styles.calendarSection}>
          {/* 헤더 */}
          <div className={styles.calendarHeader}>
            <div className={styles.calendarTitleRow}>
              <span className={styles.calendarEmoji}>📅</span>
              <h2 className={styles.calendarTitle}>나의 실천 기록</h2>
            </div>
            <div className={styles.calendarNav}>
              <button
                className={styles.calendarNavBtn}
                onClick={goToPrevMonth}
                aria-label="이전 달"
              >
                ‹
              </button>
              <span className={styles.calendarMonth}>
                {calYear}년 {calMonth + 1}월
              </span>
              <button
                className={styles.calendarNavBtn}
                onClick={goToNextMonth}
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className={styles.calendarWeekdays}>
            {WEEKDAYS.map((day) => (
              <div key={day} className={styles.weekdayCell}>
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className={styles.calendarGrid}>
            {/* 빈 셀 (첫째 주 앞 여백) */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.dayCell} />
            ))}

            {/* 날짜 셀 */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = toDateStr(calYear, calMonth, day);
              const isToday = dateStr === todayStr;
              const hasWellness = wellnessDates.has(dateStr);
              const hasHabit = habitDates.has(dateStr);
              const hasPlay = playDates.has(dateStr);
              const hasDots = hasWellness || hasHabit || hasPlay;

              return (
                <div key={day} className={styles.dayCell}>
                  <div
                    className={[
                      styles.dayNumber,
                      isToday ? styles.dayToday : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {day}
                  </div>
                  {hasDots && (
                    <div className={styles.dotRow}>
                      {hasWellness && <span className={styles.dotWellness} />}
                      {hasHabit && <span className={styles.dotHabit} />}
                      {hasPlay && <span className={styles.dotPlay} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 (Legend) */}
          <div className={styles.calendarLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDotWellness} />
              <span className={styles.legendText}>
                웰니스 솔루션 {wellnessCountThisMonth}일
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDotHabit} />
              <span className={styles.legendText}>
                위클리 해빗 {habitCountThisMonth}일
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDotPlay} />
              <span className={styles.legendText}>
                이해의 바다 {playCountThisMonth}일
              </span>
            </div>
          </div>
        </section>

        {/* ── 자율신경 밸런스 추이 ── */}
        <section className={styles.scSection}>
          <div className={styles.scHeader}>
            <span className={styles.scEmoji}>🌿</span>
            <h2 className={styles.scTitle}>자율신경 밸런스 추이</h2>
          </div>

          {selfCheckLoading ? (
            <div className={styles.scEmpty}>
              <p className={styles.scEmptyText}>불러오는 중...</p>
            </div>
          ) : selfCheckResults.length === 0 ? (
            <div className={styles.scEmpty}>
              <p className={styles.scEmptyIcon}>🔍</p>
              <p className={styles.scEmptyText}>
                아직 자율신경 자가 체크 기록이 없습니다.
              </p>
              <p className={styles.scEmptyHint}>
                웰니스 솔루션에서 자가 체크를 완료하면 여기에 결과가 표시됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* 최신 신호 강도 카드 */}
              {latestSC && (() => {
                const gradeInfo = getSignalGrade(latestSC.intensity);
                return (
                  <div className={styles.scLatest}>
                    <div className={styles.scScoreWrap}>
                      <div
                        className={styles.scScoreCircle}
                        style={{ borderColor: gradeInfo.color }}
                      >
                        <span
                          className={styles.scScoreNum}
                          style={{ color: gradeInfo.color }}
                        >
                          {latestSC.intensity}
                        </span>
                        <span className={styles.scScoreMax}>%</span>
                      </div>
                      <div className={styles.scGradeRow}>
                        <span
                          className={styles.scGradeBadge}
                          style={{ background: gradeInfo.color }}
                        >
                          {gradeInfo.grade}
                        </span>
                        <span
                          className={styles.scQualityBadge}
                          style={{ background: gradeInfo.color }}
                        >
                          {gradeInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className={styles.scLatestInfo}>
                      <span className={styles.scLatestDate}>
                        최근 체크: {formatShortDate(latestSC.testDate)}
                      </span>
                      <span className={styles.scShortLabel} style={{ color: gradeInfo.color }}>
                        {gradeInfo.shortLabel}
                      </span>
                      {scTrendDirection && prevSC && (
                        <div className={styles.scTrend}>
                          <span
                            className={styles.scTrendArrow}
                            style={{
                              color:
                                scTrendDirection === "improved"
                                  ? "#10b981"
                                  : scTrendDirection === "worsened"
                                  ? "#ef4444"
                                  : "#9ca3af",
                            }}
                          >
                            {/* 신호 강도: 낮을수록 좋음 → 감소=개선=▲, 증가=악화=▼ */}
                            {scTrendDirection === "improved"
                              ? "▲"
                              : scTrendDirection === "worsened"
                              ? "▼"
                              : "─"}
                          </span>
                          <span
                            className={styles.scTrendText}
                            style={{
                              color:
                                scTrendDirection === "improved"
                                  ? "#10b981"
                                  : scTrendDirection === "worsened"
                                  ? "#ef4444"
                                  : "#9ca3af",
                            }}
                          >
                            {(() => {
                              const diff = Math.abs(latestSC.intensity - prevSC.intensity);
                              return scTrendDirection === "improved"
                                ? `${diff}%p 개선`
                                : scTrendDirection === "worsened"
                                ? `${diff}%p 상승`
                                : "변화 없음";
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 트렌드 차트 (2개 이상일 때) */}
              {scChartData.length >= 2 && (
                <div className={styles.scChartWrap}>
                  <svg
                    viewBox={`0 0 ${scChartWidth} ${scChartHeight}`}
                    className={styles.scChart}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* 배경 영역 (양호/보통/주의 구간) — 0~100% 스케일 */}
                    {/* 양호 구간: 0~20% (상단) */}
                    <rect
                      x={scChartPadX}
                      y={scChartPadY}
                      width={scInnerW}
                      height={scInnerH * 0.2}
                      fill="rgba(16,185,129,0.06)"
                    />
                    {/* 보통 구간: 20~40% */}
                    <rect
                      x={scChartPadX}
                      y={scChartPadY + scInnerH * 0.2}
                      width={scInnerW}
                      height={scInnerH * 0.2}
                      fill="rgba(245,158,11,0.06)"
                    />
                    {/* 주의~강한 구간: 40~100% */}
                    <rect
                      x={scChartPadX}
                      y={scChartPadY + scInnerH * 0.4}
                      width={scInnerW}
                      height={scInnerH * 0.6}
                      fill="rgba(239,68,68,0.04)"
                    />

                    {/* 기준선: 20% (A등급 상한) */}
                    <line
                      x1={scChartPadX}
                      y1={scChartPadY + scInnerH * 0.2}
                      x2={scChartPadX + scInnerW}
                      y2={scChartPadY + scInnerH * 0.2}
                      stroke="rgba(16,185,129,0.2)"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* 연결선 */}
                    <polyline
                      points={scChartData
                        .map((r, i) => {
                          const x =
                            scChartPadX +
                            (scChartData.length === 1
                              ? scInnerW / 2
                              : (i / (scChartData.length - 1)) * scInnerW);
                          const y =
                            scChartPadY + (r.intensity / 100) * scInnerH;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="rgba(34,197,94,0.4)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* 데이터 포인트 */}
                    {scChartData.map((r, i) => {
                      const x =
                        scChartPadX +
                        (scChartData.length === 1
                          ? scInnerW / 2
                          : (i / (scChartData.length - 1)) * scInnerW);
                      const y =
                        scChartPadY + (r.intensity / 100) * scInnerH;
                      const gradeInfo = getSignalGrade(r.intensity);
                      return (
                        <g key={r.testDate}>
                          <circle
                            cx={x}
                            cy={y}
                            r={i === scChartData.length - 1 ? 5 : 3.5}
                            fill={gradeInfo.color}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          {/* 강도 라벨 */}
                          <text
                            x={x}
                            y={y - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="700"
                            fill={gradeInfo.color}
                          >
                            {r.intensity}%
                          </text>
                          {/* 날짜 라벨 */}
                          <text
                            x={x}
                            y={scChartHeight - 1}
                            textAnchor="middle"
                            fontSize="8"
                            fill="rgba(107,114,128,0.7)"
                          >
                            {formatShortDate(r.testDate)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className={styles.scChartLegend}>
                    <span className={styles.scChartLegendGood}>S·A 양호</span>
                    <span className={styles.scChartLegendNormal}>B·C 보통~주의</span>
                    <span className={styles.scChartLegendBad}>D·F 강한 신호</span>
                  </div>
                </div>
              )}

              {/* 자율신경 밸런스 자가 체크 다시하기 버튼 */}
              <button
                className={styles.scDetailBtn}
                onClick={() => router.push("/wellness/solution/self-check/result")}
              >
                최근 체크 결과 상세 보기
              </button>
            </>
          )}
        </section>

        {/* ── 수면 품질 (PSQI) 이력 ── */}
        <section className={styles.psqiSection}>
          <div className={styles.psqiHeader}>
            <span className={styles.psqiEmoji}>🌙</span>
            <h2 className={styles.psqiTitle}>수면 품질 추이</h2>
          </div>

          {psqiLoading ? (
            <div className={styles.psqiEmpty}>
              <p className={styles.psqiEmptyText}>불러오는 중...</p>
            </div>
          ) : psqiResults.length === 0 ? (
            <div className={styles.psqiEmpty}>
              <p className={styles.psqiEmptyIcon}>😴</p>
              <p className={styles.psqiEmptyText}>
                아직 수면 품질 검사 기록이 없습니다.
              </p>
              <p className={styles.psqiEmptyHint}>
                위클리 해빗에서 PSQI 검사를 완료하면 여기에 결과가 표시됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* 최신 점수 카드 */}
              {latestPSQI && (
                <div className={styles.psqiLatest}>
                  <div className={styles.psqiScoreWrap}>
                    <div
                      className={styles.psqiScoreCircle}
                      style={{
                        borderColor: getPSQIQualityLabel(latestPSQI.total).color,
                      }}
                    >
                      <span
                        className={styles.psqiScoreNum}
                        style={{ color: getPSQIQualityLabel(latestPSQI.total).color }}
                      >
                        {toScore10(latestPSQI.total)}
                      </span>
                      <span className={styles.psqiScoreMax}>/10</span>
                    </div>
                    <div className={styles.psqiGradeRow}>
                      <span
                        className={styles.psqiGradeBadge}
                        style={{ background: getPSQIQualityLabel(latestPSQI.total).color }}
                      >
                        {getPSQIQualityLabel(latestPSQI.total).grade}
                      </span>
                      <span
                        className={styles.psqiQualityBadge}
                        style={{
                          background: getPSQIQualityLabel(latestPSQI.total).color,
                        }}
                      >
                        {getPSQIQualityLabel(latestPSQI.total).label}
                      </span>
                    </div>
                  </div>

                  <div className={styles.psqiLatestInfo}>
                    <span className={styles.psqiLatestDate}>
                      최근 검사: {formatShortDate(latestPSQI.testDate)}
                    </span>
                    <span className={styles.psqiGapText} style={{ color: getPSQIQualityLabel(latestPSQI.total).color }}>
                      목표까지 {getGapScore(latestPSQI.total)}점
                    </span>
                    {trendDirection && (
                      <div className={styles.psqiTrend}>
                        <span
                          className={styles.psqiTrendArrow}
                          style={{
                            color:
                              trendDirection === "improved"
                                ? "#10b981"
                                : trendDirection === "worsened"
                                ? "#ef4444"
                                : "#9ca3af",
                          }}
                        >
                          {trendDirection === "improved"
                            ? "▲"
                            : trendDirection === "worsened"
                            ? "▼"
                            : "─"}
                        </span>
                        <span
                          className={styles.psqiTrendText}
                          style={{
                            color:
                              trendDirection === "improved"
                                ? "#10b981"
                                : trendDirection === "worsened"
                                ? "#ef4444"
                                : "#9ca3af",
                          }}
                        >
                          {(() => {
                            const scoreDiff = Math.abs(Math.round((toScore10(latestPSQI!.total) - toScore10(prevPSQI!.total)) * 10) / 10);
                            return trendDirection === "improved"
                              ? `${scoreDiff}점 개선`
                              : trendDirection === "worsened"
                              ? `${scoreDiff}점 하락`
                              : "변화 없음";
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 트렌드 차트 (2개 이상일 때) */}
              {chartData.length >= 2 && (
                <div className={styles.psqiChartWrap}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className={styles.psqiChart}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* 배경 영역 (양호/보통/불량 구간) */}
                    <rect
                      x={chartPadX}
                      y={chartPadY}
                      width={innerW}
                      height={innerH * (5 / 21)}
                      fill="rgba(16,185,129,0.06)"
                    />
                    <rect
                      x={chartPadX}
                      y={chartPadY + innerH * (5 / 21)}
                      width={innerW}
                      height={innerH * (5 / 21)}
                      fill="rgba(245,158,11,0.06)"
                    />
                    <rect
                      x={chartPadX}
                      y={chartPadY + innerH * (10 / 21)}
                      width={innerW}
                      height={innerH * (11 / 21)}
                      fill="rgba(239,68,68,0.04)"
                    />

                    {/* 기준선: 5점 */}
                    <line
                      x1={chartPadX}
                      y1={chartPadY + innerH * (5 / 21)}
                      x2={chartPadX + innerW}
                      y2={chartPadY + innerH * (5 / 21)}
                      stroke="rgba(16,185,129,0.2)"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* 연결선 */}
                    <polyline
                      points={chartData
                        .map((r, i) => {
                          const x =
                            chartPadX +
                            (chartData.length === 1
                              ? innerW / 2
                              : (i / (chartData.length - 1)) * innerW);
                          const y =
                            chartPadY + (r.total / 21) * innerH;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="rgba(99,102,241,0.4)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* 데이터 포인트 */}
                    {chartData.map((r, i) => {
                      const x =
                        chartPadX +
                        (chartData.length === 1
                          ? innerW / 2
                          : (i / (chartData.length - 1)) * innerW);
                      const y =
                        chartPadY + (r.total / 21) * innerH;
                      const quality = getPSQIQualityLabel(r.total);
                      return (
                        <g key={r.testDate}>
                          <circle
                            cx={x}
                            cy={y}
                            r={i === chartData.length - 1 ? 5 : 3.5}
                            fill={quality.color}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          {/* 점수 라벨 */}
                          <text
                            x={x}
                            y={y - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="700"
                            fill={quality.color}
                          >
                            {toScore10(r.total)}
                          </text>
                          {/* 날짜 라벨 */}
                          <text
                            x={x}
                            y={chartHeight - 1}
                            textAnchor="middle"
                            fontSize="8"
                            fill="rgba(107,114,128,0.7)"
                          >
                            {formatShortDate(r.testDate)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className={styles.psqiChartLegend}>
                    <span className={styles.psqiChartLegendGood}>S·A 양호</span>
                    <span className={styles.psqiChartLegendNormal}>B·C 보통~미흡</span>
                    <span className={styles.psqiChartLegendBad}>D·F 불량</span>
                  </div>
                </div>
              )}

              {/* 나의 수면 기록 돌아보기 버튼 → 새 페이지로 이동 */}
              <button
                className={styles.psqiDetailBtn}
                onClick={() => router.push("/mypage/sleep-history")}
              >
                나의 수면 기록 돌아보기
              </button>
            </>
          )}
        </section>

        {/* ── 나만의 웰니스 기록 전체 보기 ── */}
        <section className={styles.wellnessRecordSection}>
          <button
            className={styles.wellnessRecordBtn}
            onClick={() => router.push("/mypage/wellness-record")}
          >
            <span className={styles.wellnessRecordBtnText}>
              나의 웰니스 기록 보기
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.wellnessRecordBtnArrow}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </section>

      </main>

      <div className={styles.tabPadding}></div>
      <BottomTab />
    </div>
  );
}
