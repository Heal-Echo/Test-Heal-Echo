"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./wellness-record.module.css";
import { isUserLoggedIn } from "@/auth/user";
import { getSubscription } from "@/auth/subscription";
import type { UserSubscription } from "@/types/subscription";

// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

// ─────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────
type PracticeItem = { type: string; date: string };

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

type PSQIResult = {
  testDate: string;
  total: number;
  components: Record<string, number>;
  efficiency: number;
};

type SleepLogItem = {
  logKey: string;
  sleepTime: string;
  wakeTime: string;
  wakeCount?: number;
  checkedHabits?: string[];
  hadNap?: boolean;
  napStart?: string;
  napEnd?: string;
};

// ─────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────
function getSignalIntensity(categories: { percent: number }[]): number {
  const affected = categories.filter((c) => c.percent > 0);
  if (affected.length === 0) return 0;
  const avg = affected.reduce((s, c) => s + c.percent, 0) / affected.length;
  const spreadBonus = affected.length >= 3 ? Math.min(15, (affected.length - 2) * 5) : 0;
  return Math.min(100, Math.round(avg + spreadBonus));
}

function getSignalGrade(intensity: number): { grade: string; label: string; shortLabel: string; color: string } {
  if (intensity === 0) return { grade: "S", label: "신호 없음", shortLabel: "균형이 잘 유지되고 있어요", color: "#059669" };
  if (intensity <= 20) return { grade: "A", label: "약한 신호", shortLabel: "가벼운 신호가 감지되고 있어요", color: "#10b981" };
  if (intensity <= 40) return { grade: "B", label: "보통 신호", shortLabel: "몸이 보내는 신호에 귀 기울여 주세요", color: "#f59e0b" };
  if (intensity <= 60) return { grade: "C", label: "주의 신호", shortLabel: "자율신경이 균형을 잃어가고 있어요", color: "#f97316" };
  if (intensity <= 80) return { grade: "D", label: "강한 신호", shortLabel: "적극적인 균형 회복이 필요해요", color: "#ef4444" };
  return { grade: "F", label: "매우 강한 신호", shortLabel: "지금 바로 시작하는 게 중요해요", color: "#dc2626" };
}

function getPSQIQualityLabel(total: number): { label: string; color: string; grade: string } {
  if (total <= 2) return { label: "최상", color: "#059669", grade: "S" };
  if (total <= 5) return { label: "양호", color: "#10b981", grade: "A" };
  if (total <= 7) return { label: "보통", color: "#f59e0b", grade: "B" };
  if (total <= 10) return { label: "미흡", color: "#f97316", grade: "C" };
  if (total <= 15) return { label: "불량", color: "#ef4444", grade: "D" };
  return { label: "매우 불량", color: "#dc2626", grade: "F" };
}

function toScore10(total: number): number {
  return Math.round(Math.pow(1 - total / 21, 1.6) * 100) / 10;
}

function getGapScore(total: number): number {
  return Math.round((10 - toScore10(total)) * 10) / 10;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** HH:MM → 소수 시간 (취침: 18시 이후 음수 변환) */
function parseTimeToHour(hhmm: string, isBedtime: boolean): number | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const hour = h + m / 60;
  if (isBedtime && hour >= 18) return hour - 24;
  return hour;
}

/** 소수 시간 → "HH:MM" */
function hourToLabel(h: number): string {
  let hr = h < 0 ? h + 24 : h;
  const hh = Math.floor(hr);
  const mm = Math.round((hr - hh) * 60);
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function daysInMonthUtil(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// 달력 유틸
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

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export default function WellnessRecordPage() {
  const router = useRouter();

  // 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // ─── 상태 ───
  const [loading, setLoading] = useState(true);
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>([]);
  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckResultItem[]>([]);
  const [psqiResults, setPsqiResults] = useState<PSQIResult[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLogItem[]>([]);
  const [habitItems, setHabitItems] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  // 달력 상태
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // 수면 차트 월 네비게이션
  const [sleepYear, setSleepYear] = useState(now.getFullYear());
  const [sleepMonth, setSleepMonth] = useState(now.getMonth());

  // ─── 데이터 fetch ───
  useEffect(() => {
    let completed = 0;
    const total = 6;
    const checkDone = () => { completed++; if (completed >= total) setLoading(false); };

    const userToken = storage.getRaw("user_id_token");
    const authHeaders: Record<string, string> = userToken ? { Authorization: `Bearer ${userToken}` } : {};

    // 1) 실천 기록
    (async () => {
      try {
        const res = await fetch("/api/user/practice-record", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setPracticeItems(data.items || []);
        }
      } catch (err) { console.error("실천 기록 조회 실패:", err); }
      finally { checkDone(); }
    })();

    // 2) 자가체크 결과
    (async () => {
      try {
        const res = await fetch("/api/user/selfcheck-result", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const items: SelfCheckResultItem[] = Array.isArray(data) ? data : data.items || data.results || [];
          items.sort((a, b) => a.testDate.localeCompare(b.testDate));
          setSelfCheckResults(items);
        }
      } catch (err) { console.error("자가 체크 조회 실패:", err); }
      finally { checkDone(); }
    })();

    // 3) PSQI 결과
    (async () => {
      try {
        const res = await fetch("/api/user/psqi-result", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const items: PSQIResult[] = Array.isArray(data) ? data : data.items || data.results || [];
          items.sort((a, b) => a.testDate.localeCompare(b.testDate));
          setPsqiResults(items);
        }
      } catch (err) { console.error("PSQI 조회 실패:", err); }
      finally { checkDone(); }
    })();

    // 4) 수면 로그
    (async () => {
      try {
        const res = await fetch("/api/user/sleep-log", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const items: SleepLogItem[] = (data.items || []);
          items.sort((a: SleepLogItem, b: SleepLogItem) => a.logKey.localeCompare(b.logKey));
          setSleepLogs(items);
        }
      } catch (err) { console.error("수면 로그 조회 실패:", err); }
      finally { checkDone(); }
    })();

    // 5) 습관 설정
    (async () => {
      try {
        const res = await fetch("/api/user/sleep-log/config", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const items: string[] = data.item?.habitItems || data.habitItems || [];
          if (items.length > 0) { setHabitItems(items); checkDone(); return; }
        }
      } catch {}
      // 폴백: storage 레이어에서 사용자별 커스텀 습관 항목 조회
      try {
        storage.migrateKey("weekly_habit_custom_items");
        const saved = storage.get("weekly_habit_custom_items");
        if (saved) {
          const items: string[] = JSON.parse(saved);
          if (items.length > 0) { setHabitItems(items); checkDone(); return; }
        }
      } catch {}
      setHabitItems(["핸드폰 멀리두고 자기"]);
      checkDone();
    })();

    // 6) 구독 정보
    (async () => {
      try {
        const sub = await getSubscription("autobalance");
        setSubscription(sub);
      } catch (err) { console.error("구독 조회 실패:", err); }
      finally { checkDone(); }
    })();
  }, []);

  // ─── 파생 데이터 ───
  const solutionDates = useMemo(() => new Set(practiceItems.filter((i) => i.type === "solution").map((i) => i.date)), [practiceItems]);
  const habitDates = useMemo(() => new Set(practiceItems.filter((i) => i.type === "habit").map((i) => i.date)), [practiceItems]);
  const understandingDates = useMemo(() => new Set(practiceItems.filter((i) => i.type === "understanding").map((i) => i.date)), [practiceItems]);

  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  // ❶ 종합 웰니스 스코어 계산 (4축 레이더: 요가, 수면습관, 식습관, 마음습관)
  const wellnessScore = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = toDateStr(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate());

    // 요가 (솔루션 실천 — 최근 30일 실천일 / 30 * 100)
    const recentSolution = new Set<string>();
    practiceItems.forEach((item) => {
      if (item.type === "solution" && item.date >= thirtyStr) recentSolution.add(item.date);
    });
    const yogaScore = Math.min(100, Math.round((recentSolution.size / 30) * 100));

    // 수면습관 (PSQI 최신 — toScore10 * 10, 높을수록 좋음)
    const latestPSQI = psqiResults.length > 0 ? psqiResults[psqiResults.length - 1] : null;
    const sleepScore = latestPSQI ? Math.round(toScore10(latestPSQI.total) * 10) : 0;

    // 식습관 (해빗 실천 — 최근 30일 체크일 / 30 * 100)
    const recentHabit = new Set<string>();
    practiceItems.forEach((item) => {
      if (item.type === "habit" && item.date >= thirtyStr) recentHabit.add(item.date);
    });
    // + 수면 로그의 checkedHabits 카운트 보정
    const habitLogDays = new Set<string>();
    sleepLogs.forEach((l) => {
      if (l.logKey >= thirtyStr && l.checkedHabits && l.checkedHabits.length > 0) {
        habitLogDays.add(l.logKey);
      }
    });
    const dietDays = new Set([...recentHabit, ...habitLogDays]);
    const dietScore = Math.min(100, Math.round((dietDays.size / 30) * 100));

    // 마음습관 (이해의 바다 실천 + 자가체크 역산 — 복합 점수)
    const recentUnderstanding = new Set<string>();
    practiceItems.forEach((item) => {
      if (item.type === "understanding" && item.date >= thirtyStr) recentUnderstanding.add(item.date);
    });
    const mindPractice = Math.min(100, Math.round((recentUnderstanding.size / 30) * 100));
    const latestSC = selfCheckResults.length > 0 ? selfCheckResults[selfCheckResults.length - 1] : null;
    const mindBalance = latestSC ? Math.max(0, 100 - getSignalIntensity(latestSC.categories)) : 0;
    // 실천 60% + 밸런스 40% (데이터 없으면 실천만)
    const mindScore = latestSC
      ? Math.round(mindPractice * 0.6 + mindBalance * 0.4)
      : mindPractice;

    // 종합 (4축 평균)
    const overall = Math.round((yogaScore + sleepScore + dietScore + mindScore) / 4);

    return {
      overall,
      axes: [
        { key: "yoga", label: "요가", icon: "🧘", score: yogaScore, color: "#6366f1" },
        { key: "sleep", label: "수면습관", icon: "🌙", score: sleepScore, color: "#8b5cf6" },
        { key: "diet", label: "식습관", icon: "🥗", score: dietScore, color: "#22c55e" },
        { key: "mind", label: "마음습관", icon: "🧠", score: mindScore, color: "#f59e0b" },
      ],
    };
  }, [selfCheckResults, psqiResults, practiceItems, sleepLogs]);

  // 스코어 색상
  const scoreColor = wellnessScore.overall >= 70 ? "#10b981" : wellnessScore.overall >= 40 ? "#f59e0b" : "#ef4444";

  // ❷ 변화 하이라이트
  const changeHighlight = useMemo(() => {
    const firstSC = selfCheckResults.length > 0 ? selfCheckResults[0] : null;
    const lastSC = selfCheckResults.length > 0 ? selfCheckResults[selfCheckResults.length - 1] : null;
    const firstPSQI = psqiResults.length > 0 ? psqiResults[0] : null;
    const lastPSQI = psqiResults.length > 0 ? psqiResults[psqiResults.length - 1] : null;

    return {
      scFirst: firstSC ? getSignalIntensity(firstSC.categories) : null,
      scLast: lastSC ? getSignalIntensity(lastSC.categories) : null,
      scHasMultiple: selfCheckResults.length >= 2,
      psqiFirst: firstPSQI ? toScore10(firstPSQI.total) : null,
      psqiLast: lastPSQI ? toScore10(lastPSQI.total) : null,
      psqiHasMultiple: psqiResults.length >= 2,
    };
  }, [selfCheckResults, psqiResults]);

  // ❸ 주간 리포트
  const weeklyReport = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = toDateStr(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());

    let solutionCount = 0;
    let habitCount = 0;
    let seaCount = 0;
    practiceItems.forEach((item) => {
      if (item.date >= weekStartStr) {
        if (item.type === "solution") solutionCount++;
        else if (item.type === "habit") habitCount++;
        else if (item.type === "understanding") seaCount++;
      }
    });

    // 이번 주 평균 수면 시간
    const weekLogs = sleepLogs.filter((l) => l.logKey >= weekStartStr && l.sleepTime && l.wakeTime);
    let avgSleepHours = 0;
    if (weekLogs.length > 0) {
      const totalHours = weekLogs.reduce((sum, l) => {
        const bed = parseTimeToHour(l.sleepTime, true);
        const wake = parseTimeToHour(l.wakeTime, false);
        if (bed !== null && wake !== null) return sum + (wake - bed);
        return sum;
      }, 0);
      avgSleepHours = Math.round((totalHours / weekLogs.length) * 10) / 10;
    }

    return { solutionCount, habitCount, seaCount, avgSleepHours, hasSleepData: weekLogs.length > 0 };
  }, [practiceItems, sleepLogs]);

  // ❺ 자율신경 밸런스 추이
  const selfCheckWithIntensity = useMemo(() =>
    selfCheckResults.map((r) => ({ ...r, intensity: getSignalIntensity(r.categories) })),
    [selfCheckResults]
  );

  const latestSC = selfCheckWithIntensity.length > 0 ? selfCheckWithIntensity[selfCheckWithIntensity.length - 1] : null;
  const prevSC = selfCheckWithIntensity.length > 1 ? selfCheckWithIntensity[selfCheckWithIntensity.length - 2] : null;

  let scTrendDirection: "improved" | "same" | "worsened" | null = null;
  if (latestSC && prevSC) {
    const diff = latestSC.intensity - prevSC.intensity;
    if (diff < 0) scTrendDirection = "improved";
    else if (diff > 0) scTrendDirection = "worsened";
    else scTrendDirection = "same";
  }

  const scChartData = selfCheckWithIntensity.slice(-6);

  // ❻ PSQI 추이
  const latestPSQI = psqiResults.length > 0 ? psqiResults[psqiResults.length - 1] : null;
  const prevPSQI = psqiResults.length > 1 ? psqiResults[psqiResults.length - 2] : null;

  let psqiTrendDirection: "improved" | "same" | "worsened" | null = null;
  if (latestPSQI && prevPSQI) {
    const diff = latestPSQI.total - prevPSQI.total;
    if (diff < 0) psqiTrendDirection = "improved";
    else if (diff > 0) psqiTrendDirection = "worsened";
    else psqiTrendDirection = "same";
  }

  const psqiChartData = psqiResults.slice(-6);

  // ❼ 수면 상세 (월별)
  const sleepMonthData = useMemo(() => {
    const totalDays = daysInMonthUtil(sleepYear, sleepMonth);
    const monthPrefix = `${sleepYear}-${String(sleepMonth + 1).padStart(2, "0")}`;
    const filtered = sleepLogs.filter((l) => l.logKey.startsWith(monthPrefix) && l.sleepTime && l.wakeTime);

    return filtered.map((l) => {
      const day = parseInt(l.logKey.split("-")[2], 10);
      const bed = parseTimeToHour(l.sleepTime, true);
      const wake = parseTimeToHour(l.wakeTime, false);
      const hours = bed !== null && wake !== null ? wake - bed : 0;
      return { day, bed, wake, hours, logKey: l.logKey };
    }).filter((d) => d.bed !== null && d.wake !== null);
  }, [sleepLogs, sleepYear, sleepMonth]);

  const isNextSleepDisabled = sleepYear === now.getFullYear() && sleepMonth === now.getMonth();

  // ❽ 위클리 솔루션 현황
  const solutionSummary = useMemo(() => {
    const solDates = Array.from(solutionDates).sort();
    const totalDays = solDates.length;
    const currentWeek = subscription?.currentWeek || 1;
    return { totalDays, currentWeek };
  }, [solutionDates, subscription]);

  // ❾ 습관 바 차트 (최근 4주)
  const habitChartData = useMemo(() => {
    const weeks: { label: string; habits: Record<string, number> }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const weekStartStr = toDateStr(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      const weekEndStr = toDateStr(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}~`;

      const habitsCount: Record<string, number> = {};
      habitItems.forEach((h) => { habitsCount[h] = 0; });

      sleepLogs.forEach((l) => {
        if (l.logKey >= weekStartStr && l.logKey <= weekEndStr && l.checkedHabits) {
          l.checkedHabits.forEach((h) => {
            if (habitsCount[h] !== undefined) habitsCount[h]++;
          });
        }
      });

      weeks.push({ label, habits: habitsCount });
    }
    return weeks;
  }, [sleepLogs, habitItems]);

  // ❿ 이해의 바다
  const seaSummary = useMemo(() => {
    const dates = Array.from(understandingDates);
    return { totalSessions: dates.length };
  }, [understandingDates]);

  // ─── 달력 네비게이션 ───
  const goToPrevMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 0) { setCalYear((y) => y - 1); return 11; }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 11) { setCalYear((y) => y + 1); return 0; }
      return prev + 1;
    });
  }, []);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  // SVG 차트 공통 치수
  const chartW = 280;
  const chartH = 80;
  const padX = 24;
  const padY = 12;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  // ─── 로딩 상태 ───
  if (loading) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.loadingWrap}>
            <div className={styles.loadingSpinner} />
            <span className={styles.loadingText}>웰니스 기록을 불러오는 중...</span>
          </div>
        </main>
        <div className={styles.tabPadding} />
        <BottomTab />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* ══ 히어로 ══ */}
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>나만의 웰니스 기록</h1>
          <p className={styles.heroSub}>지금까지의 실천이 만들어낸 변화를 확인해 보세요.</p>
        </section>

        {/* ══ ❶ 종합 웰니스 스코어 (레이더 차트) ══ */}
        <section className={styles.scoreSection}>
          {/* 레이더 차트 */}
          <div className={styles.radarWrap}>
            <svg viewBox="0 0 260 260" className={styles.radarSvg}>
              {/* 배경 거미줄 (20, 40, 60, 80, 100) */}
              {[20, 40, 60, 80, 100].map((level) => {
                const cx = 130, cy = 130, maxR = 90;
                const r = (level / 100) * maxR;
                const angles = [0, 1, 2, 3].map((i) => (Math.PI / 2) + (i * 2 * Math.PI) / 4);
                const pts = angles.map((a) => `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`).join(" ");
                return (
                  <polygon key={level} points={pts} fill="none" stroke="#e5e7eb" strokeWidth={level === 100 ? "1" : "0.5"} />
                );
              })}

              {/* 축 선 */}
              {[0, 1, 2, 3].map((i) => {
                const cx = 130, cy = 130, maxR = 90;
                const a = (Math.PI / 2) + (i * 2 * Math.PI) / 4;
                return (
                  <line key={i} x1={cx} y1={cy} x2={cx + maxR * Math.cos(a)} y2={cy - maxR * Math.sin(a)} stroke="#e5e7eb" strokeWidth="0.5" />
                );
              })}

              {/* 눈금 라벨 (20, 40, 60, 80, 100) */}
              {[20, 40, 60, 80, 100].map((level) => {
                const cx = 130, cy = 130, maxR = 90;
                const r = (level / 100) * maxR;
                return (
                  <text key={level} x={cx + 3} y={cy - r + 3} fontSize="8" fill="#d1d5db" textAnchor="start">{level}</text>
                );
              })}

              {/* 데이터 영역 (채우기) */}
              {(() => {
                const cx = 130, cy = 130, maxR = 90;
                const axes = wellnessScore.axes;
                const pts = axes.map((axis, i) => {
                  const a = (Math.PI / 2) + (i * 2 * Math.PI) / 4;
                  const r = (axis.score / 100) * maxR;
                  return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
                }).join(" ");
                return (
                  <>
                    <polygon points={pts} fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
                    {/* 데이터 포인트 */}
                    {axes.map((axis, i) => {
                      const a = (Math.PI / 2) + (i * 2 * Math.PI) / 4;
                      const r = (axis.score / 100) * maxR;
                      const x = cx + r * Math.cos(a);
                      const y = cy - r * Math.sin(a);
                      return <circle key={axis.key} cx={x} cy={y} r="3.5" fill="rgba(99,102,241,0.8)" stroke="#ffffff" strokeWidth="1.5" />;
                    })}
                  </>
                );
              })()}

              {/* 축 라벨 (아이콘 + 텍스트) */}
              {wellnessScore.axes.map((axis, i) => {
                const cx = 130, cy = 130, labelR = 108;
                const a = (Math.PI / 2) + (i * 2 * Math.PI) / 4;
                const lx = cx + labelR * Math.cos(a);
                const ly = cy - labelR * Math.sin(a);
                // 위치 보정
                const anchor = i === 0 ? "middle" : i === 1 ? "end" : i === 2 ? "middle" : "start";
                const dy = i === 0 ? -6 : i === 2 ? 14 : 4;
                return (
                  <text key={axis.key} x={lx} y={ly + dy} textAnchor={anchor} fontSize="11" fontWeight="600" fill="#374151">
                    {axis.label}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* 종합 점수 + 범례 */}
          <div className={styles.radarFooter}>
            <div className={styles.radarOverall}>
              <span className={styles.radarOverallNum} style={{ color: scoreColor }}>{wellnessScore.overall}</span>
              <span className={styles.radarOverallLabel}>종합 점수</span>
            </div>
            <div className={styles.radarLegend}>
              {wellnessScore.axes.map((axis) => (
                <div key={axis.key} className={styles.radarLegendItem}>
                  <span className={styles.radarLegendIcon}>{axis.icon}</span>
                  <span className={styles.radarLegendLabel}>{axis.label}</span>
                  <span className={styles.radarLegendValue} style={{ color: axis.color }}>{axis.score}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ ❷ 변화 하이라이트 ══ */}
        {(changeHighlight.scHasMultiple || changeHighlight.psqiHasMultiple) && (
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionEmoji}>✨</span>
              <h2 className={styles.sectionTitle}>변화 하이라이트</h2>
            </div>
            <div className={styles.highlightGrid}>
              {/* 자율신경 변화 */}
              {changeHighlight.scHasMultiple && changeHighlight.scFirst !== null && changeHighlight.scLast !== null && (
                <div className={styles.highlightCard}>
                  <p className={styles.highlightLabel}>불균형 신호</p>
                  <div className={styles.highlightValueRow}>
                    <span className={styles.highlightBefore}>{changeHighlight.scFirst}%</span>
                    <span className={styles.highlightArrow}>→</span>
                    <span className={styles.highlightAfter} style={{ color: getSignalGrade(changeHighlight.scLast).color }}>
                      {changeHighlight.scLast}%
                    </span>
                  </div>
                  {(() => {
                    const diff = changeHighlight.scFirst! - changeHighlight.scLast!;
                    if (diff > 0) return <p className={styles.highlightChange} style={{ color: "#10b981" }}>{diff}%p 개선</p>;
                    if (diff < 0) return <p className={styles.highlightChange} style={{ color: "#ef4444" }}>{Math.abs(diff)}%p 상승</p>;
                    return <p className={styles.highlightChange} style={{ color: "#9ca3af" }}>변화 없음</p>;
                  })()}
                </div>
              )}

              {/* PSQI 변화 */}
              {changeHighlight.psqiHasMultiple && changeHighlight.psqiFirst !== null && changeHighlight.psqiLast !== null && (
                <div className={styles.highlightCard}>
                  <p className={styles.highlightLabel}>수면 품질</p>
                  <div className={styles.highlightValueRow}>
                    <span className={styles.highlightBefore}>{changeHighlight.psqiFirst}</span>
                    <span className={styles.highlightArrow}>→</span>
                    <span className={styles.highlightAfter} style={{ color: getPSQIQualityLabel(psqiResults[psqiResults.length - 1].total).color }}>
                      {changeHighlight.psqiLast}
                    </span>
                  </div>
                  {(() => {
                    const diff = Math.round((changeHighlight.psqiLast! - changeHighlight.psqiFirst!) * 10) / 10;
                    if (diff > 0) return <p className={styles.highlightChange} style={{ color: "#10b981" }}>+{diff}점 개선</p>;
                    if (diff < 0) return <p className={styles.highlightChange} style={{ color: "#ef4444" }}>{diff}점 하락</p>;
                    return <p className={styles.highlightChange} style={{ color: "#9ca3af" }}>변화 없음</p>;
                  })()}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══ ❸ 주간 리포트 카드 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>📊</span>
            <h2 className={styles.sectionTitle}>이번 주 리포트</h2>
          </div>
          <div className={styles.weeklyGrid}>
            <div className={styles.weeklyItem}>
              <div className={styles.weeklyItemIcon}>🧘</div>
              <div className={styles.weeklyItemValue}>
                {weeklyReport.solutionCount}<span className={styles.weeklyItemUnit}>회</span>
              </div>
              <div className={styles.weeklyItemLabel}>솔루션</div>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.weeklyItemIcon}>🌙</div>
              <div className={styles.weeklyItemValue}>
                {weeklyReport.habitCount}<span className={styles.weeklyItemUnit}>회</span>
              </div>
              <div className={styles.weeklyItemLabel}>해빗</div>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.weeklyItemIcon}>🌊</div>
              <div className={styles.weeklyItemValue}>
                {weeklyReport.seaCount}<span className={styles.weeklyItemUnit}>회</span>
              </div>
              <div className={styles.weeklyItemLabel}>이해의 바다</div>
            </div>
            <div className={styles.weeklyItem}>
              <div className={styles.weeklyItemIcon}>😴</div>
              <div className={styles.weeklyItemValue}>
                {weeklyReport.hasSleepData ? weeklyReport.avgSleepHours : "-"}
                <span className={styles.weeklyItemUnit}>{weeklyReport.hasSleepData ? "시간" : ""}</span>
              </div>
              <div className={styles.weeklyItemLabel}>평균 수면</div>
            </div>
          </div>
        </section>

        {/* ══ ❹ 통합 실천 달력 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>📅</span>
            <h2 className={styles.sectionTitle}>통합 실천 달력</h2>
          </div>

          <div className={styles.calendarNav}>
            <button className={styles.calendarNavBtn} onClick={goToPrevMonth} aria-label="이전 달">‹</button>
            <span className={styles.calendarMonth}>{calYear}년 {calMonth + 1}월</span>
            <button className={styles.calendarNavBtn} onClick={goToNextMonth} aria-label="다음 달">›</button>
          </div>

          <div className={styles.calendarWeekdays}>
            {WEEKDAYS.map((day) => (
              <div key={day} className={styles.weekdayCell}>{day}</div>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = toDateStr(calYear, calMonth, day);
              const isToday = dateStr === todayStr;
              const hasWellness = solutionDates.has(dateStr);
              const hasHabit = habitDates.has(dateStr);
              const hasPlay = understandingDates.has(dateStr);
              const hasDots = hasWellness || hasHabit || hasPlay;

              return (
                <div key={day} className={styles.dayCell}>
                  <div className={[styles.dayNumber, isToday ? styles.dayToday : ""].filter(Boolean).join(" ")}>
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

          <div className={styles.calendarLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDotWellness} />
              <span className={styles.legendText}>솔루션</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDotHabit} />
              <span className={styles.legendText}>해빗</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDotPlay} />
              <span className={styles.legendText}>이해의 바다</span>
            </div>
          </div>
        </section>

        {/* ══ ❺ 자율신경 밸런스 추이 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🌿</span>
            <h2 className={styles.sectionTitle}>자율신경 밸런스 추이</h2>
          </div>

          {selfCheckResults.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <p className={styles.emptyText}>아직 자율신경 자가 체크 기록이 없습니다.</p>
              <p className={styles.emptyHint}>웰니스 솔루션에서 자가 체크를 완료하면 여기에 표시됩니다.</p>
              <button className={styles.emptyCta} onClick={() => router.push("/wellness/solution")}>자가 체크 하러가기</button>
            </div>
          ) : (
            <>
              {latestSC && (() => {
                const gradeInfo = getSignalGrade(latestSC.intensity);
                return (
                  <div className={styles.scLatest}>
                    <div className={styles.scScoreWrap}>
                      <div className={styles.scScoreCircle} style={{ borderColor: gradeInfo.color }}>
                        <span className={styles.scScoreNum} style={{ color: gradeInfo.color }}>{latestSC.intensity}</span>
                        <span className={styles.scScoreMax}>%</span>
                      </div>
                      <div className={styles.scGradeRow}>
                        <span className={styles.scGradeBadge} style={{ background: gradeInfo.color }}>{gradeInfo.grade}</span>
                        <span className={styles.scQualityBadge} style={{ background: gradeInfo.color }}>{gradeInfo.label}</span>
                      </div>
                    </div>
                    <div className={styles.scLatestInfo}>
                      <span className={styles.scLatestDate}>최근 체크: {formatShortDate(latestSC.testDate)}</span>
                      <span className={styles.scShortLabel} style={{ color: gradeInfo.color }}>{gradeInfo.shortLabel}</span>
                      {scTrendDirection && prevSC && (
                        <div className={styles.scTrend}>
                          <span className={styles.scTrendArrow} style={{
                            color: scTrendDirection === "improved" ? "#10b981" : scTrendDirection === "worsened" ? "#ef4444" : "#9ca3af",
                          }}>
                            {scTrendDirection === "improved" ? "▲" : scTrendDirection === "worsened" ? "▼" : "─"}
                          </span>
                          <span className={styles.scTrendText} style={{
                            color: scTrendDirection === "improved" ? "#10b981" : scTrendDirection === "worsened" ? "#ef4444" : "#9ca3af",
                          }}>
                            {(() => {
                              const diff = Math.abs(latestSC.intensity - prevSC.intensity);
                              return scTrendDirection === "improved" ? `${diff}%p 개선` : scTrendDirection === "worsened" ? `${diff}%p 상승` : "변화 없음";
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {scChartData.length >= 2 && (
                <div className={styles.scChartWrap}>
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className={styles.scChart} preserveAspectRatio="xMidYMid meet">
                    <rect x={padX} y={padY} width={innerW} height={innerH * 0.2} fill="rgba(16,185,129,0.06)" />
                    <rect x={padX} y={padY + innerH * 0.2} width={innerW} height={innerH * 0.2} fill="rgba(245,158,11,0.06)" />
                    <rect x={padX} y={padY + innerH * 0.4} width={innerW} height={innerH * 0.6} fill="rgba(239,68,68,0.04)" />
                    <line x1={padX} y1={padY + innerH * 0.2} x2={padX + innerW} y2={padY + innerH * 0.2} stroke="rgba(16,185,129,0.2)" strokeDasharray="3,3" strokeWidth="1" />
                    <polyline
                      points={scChartData.map((r, i) => {
                        const x = padX + (scChartData.length === 1 ? innerW / 2 : (i / (scChartData.length - 1)) * innerW);
                        const y = padY + (r.intensity / 100) * innerH;
                        return `${x},${y}`;
                      }).join(" ")}
                      fill="none" stroke="rgba(34,197,94,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    />
                    {scChartData.map((r, i) => {
                      const x = padX + (scChartData.length === 1 ? innerW / 2 : (i / (scChartData.length - 1)) * innerW);
                      const y = padY + (r.intensity / 100) * innerH;
                      const gi = getSignalGrade(r.intensity);
                      return (
                        <g key={r.testDate}>
                          <circle cx={x} cy={y} r={i === scChartData.length - 1 ? 5 : 3.5} fill={gi.color} stroke="#fff" strokeWidth="1.5" />
                          <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={gi.color}>{r.intensity}%</text>
                          <text x={x} y={chartH - 1} textAnchor="middle" fontSize="8" fill="rgba(107,114,128,0.7)">{formatShortDate(r.testDate)}</text>
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
            </>
          )}
        </section>

        {/* ══ ❻ 수면 품질 추이 (PSQI) ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🌙</span>
            <h2 className={styles.sectionTitle}>수면 품질 추이</h2>
          </div>

          {psqiResults.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>😴</div>
              <p className={styles.emptyText}>아직 수면 품질 검사 기록이 없습니다.</p>
              <p className={styles.emptyHint}>위클리 해빗에서 PSQI 검사를 완료하면 여기에 표시됩니다.</p>
              <button className={styles.emptyCta} onClick={() => router.push("/wellness/weekly-habit")}>PSQI 검사 하러가기</button>
            </div>
          ) : (
            <>
              {latestPSQI && (
                <div className={styles.psqiLatest}>
                  <div className={styles.psqiScoreWrap}>
                    <div className={styles.psqiScoreCircle} style={{ borderColor: getPSQIQualityLabel(latestPSQI.total).color }}>
                      <span className={styles.psqiScoreNum} style={{ color: getPSQIQualityLabel(latestPSQI.total).color }}>{toScore10(latestPSQI.total)}</span>
                      <span className={styles.psqiScoreMax}>/10</span>
                    </div>
                    <div className={styles.psqiGradeRow}>
                      <span className={styles.psqiGradeBadge} style={{ background: getPSQIQualityLabel(latestPSQI.total).color }}>{getPSQIQualityLabel(latestPSQI.total).grade}</span>
                      <span className={styles.psqiQualityBadge} style={{ background: getPSQIQualityLabel(latestPSQI.total).color }}>{getPSQIQualityLabel(latestPSQI.total).label}</span>
                    </div>
                  </div>
                  <div className={styles.psqiLatestInfo}>
                    <span className={styles.psqiLatestDate}>최근 검사: {formatShortDate(latestPSQI.testDate)}</span>
                    <span className={styles.psqiGapText} style={{ color: getPSQIQualityLabel(latestPSQI.total).color }}>목표까지 {getGapScore(latestPSQI.total)}점</span>
                    {psqiTrendDirection && prevPSQI && (
                      <div className={styles.psqiTrend}>
                        <span className={styles.psqiTrendArrow} style={{
                          color: psqiTrendDirection === "improved" ? "#10b981" : psqiTrendDirection === "worsened" ? "#ef4444" : "#9ca3af",
                        }}>
                          {psqiTrendDirection === "improved" ? "▲" : psqiTrendDirection === "worsened" ? "▼" : "─"}
                        </span>
                        <span className={styles.psqiTrendText} style={{
                          color: psqiTrendDirection === "improved" ? "#10b981" : psqiTrendDirection === "worsened" ? "#ef4444" : "#9ca3af",
                        }}>
                          {(() => {
                            const scoreDiff = Math.abs(Math.round((toScore10(latestPSQI.total) - toScore10(prevPSQI.total)) * 10) / 10);
                            return psqiTrendDirection === "improved" ? `${scoreDiff}점 개선` : psqiTrendDirection === "worsened" ? `${scoreDiff}점 하락` : "변화 없음";
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {psqiChartData.length >= 2 && (
                <div className={styles.psqiChartWrap}>
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className={styles.psqiChart} preserveAspectRatio="xMidYMid meet">
                    <rect x={padX} y={padY} width={innerW} height={innerH * (5 / 21)} fill="rgba(16,185,129,0.06)" />
                    <rect x={padX} y={padY + innerH * (5 / 21)} width={innerW} height={innerH * (5 / 21)} fill="rgba(245,158,11,0.06)" />
                    <rect x={padX} y={padY + innerH * (10 / 21)} width={innerW} height={innerH * (11 / 21)} fill="rgba(239,68,68,0.04)" />
                    <line x1={padX} y1={padY + innerH * (5 / 21)} x2={padX + innerW} y2={padY + innerH * (5 / 21)} stroke="rgba(16,185,129,0.2)" strokeDasharray="3,3" strokeWidth="1" />
                    <polyline
                      points={psqiChartData.map((r, i) => {
                        const x = padX + (psqiChartData.length === 1 ? innerW / 2 : (i / (psqiChartData.length - 1)) * innerW);
                        const y = padY + (r.total / 21) * innerH;
                        return `${x},${y}`;
                      }).join(" ")}
                      fill="none" stroke="rgba(99,102,241,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    />
                    {psqiChartData.map((r, i) => {
                      const x = padX + (psqiChartData.length === 1 ? innerW / 2 : (i / (psqiChartData.length - 1)) * innerW);
                      const y = padY + (r.total / 21) * innerH;
                      const quality = getPSQIQualityLabel(r.total);
                      return (
                        <g key={r.testDate}>
                          <circle cx={x} cy={y} r={i === psqiChartData.length - 1 ? 5 : 3.5} fill={quality.color} stroke="#fff" strokeWidth="1.5" />
                          <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={quality.color}>{toScore10(r.total)}</text>
                          <text x={x} y={chartH - 1} textAnchor="middle" fontSize="8" fill="rgba(107,114,128,0.7)">{formatShortDate(r.testDate)}</text>
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
            </>
          )}
        </section>

        {/* ══ ❼ 수면 상세 그래프 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🛏️</span>
            <h2 className={styles.sectionTitle}>수면 상세 그래프</h2>
          </div>

          {sleepLogs.filter((l) => l.sleepTime && l.wakeTime).length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🌙</div>
              <p className={styles.emptyText}>아직 수면 기록이 없습니다.</p>
              <p className={styles.emptyHint}>위클리 해빗에서 수면 로그를 기록하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className={styles.sleepChartNav}>
                <button className={styles.sleepChartNavBtn} onClick={() => {
                  if (sleepMonth === 0) { setSleepYear((y) => y - 1); setSleepMonth(11); }
                  else setSleepMonth((m) => m - 1);
                }}>‹</button>
                <span className={styles.sleepChartMonth}>{sleepYear}년 {sleepMonth + 1}월</span>
                <button className={styles.sleepChartNavBtn} disabled={isNextSleepDisabled} onClick={() => {
                  if (sleepMonth === 11) { setSleepYear((y) => y + 1); setSleepMonth(0); }
                  else setSleepMonth((m) => m + 1);
                }}>›</button>
              </div>

              {sleepMonthData.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>이 달의 수면 기록이 없습니다.</p>
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 300 140" className={styles.sleepChartSvg} preserveAspectRatio="xMidYMid meet">
                    {/* Y축 기준선 (시간) */}
                    {[-2, 0, 2, 4, 6, 8, 10].map((h) => {
                      const yMin = -4; const yMax = 12;
                      const y = 15 + ((h - yMin) / (yMax - yMin)) * 110;
                      return (
                        <g key={h}>
                          <line x1="30" y1={y} x2="290" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
                          <text x="26" y={y + 3} textAnchor="end" fontSize="7" fill="#9ca3af">{hourToLabel(h)}</text>
                        </g>
                      );
                    })}
                    {/* 데이터 포인트 */}
                    {sleepMonthData.map((d, i) => {
                      const totalDays = daysInMonthUtil(sleepYear, sleepMonth);
                      const x = 30 + ((d.day - 1) / (totalDays - 1)) * 260;
                      const yMin = -4; const yMax = 12;
                      const bedY = d.bed !== null ? 15 + ((d.bed - yMin) / (yMax - yMin)) * 110 : null;
                      const wakeY = d.wake !== null ? 15 + ((d.wake - yMin) / (yMax - yMin)) * 110 : null;

                      return (
                        <g key={d.logKey}>
                          {bedY !== null && wakeY !== null && (
                            <line x1={x} y1={bedY} x2={x} y2={wakeY} stroke="rgba(99,102,241,0.15)" strokeWidth="3" strokeLinecap="round" />
                          )}
                          {bedY !== null && <circle cx={x} cy={bedY} r="2.5" fill="#6366f1" />}
                          {wakeY !== null && <circle cx={x} cy={wakeY} r="2.5" fill="#f59e0b" />}
                        </g>
                      );
                    })}
                    {/* 취침 연결선 */}
                    {sleepMonthData.length >= 2 && (
                      <>
                        <polyline
                          points={sleepMonthData.filter((d) => d.bed !== null).map((d) => {
                            const totalDays = daysInMonthUtil(sleepYear, sleepMonth);
                            const x = 30 + ((d.day - 1) / (totalDays - 1)) * 260;
                            const yMin = -4; const yMax = 12;
                            const y = 15 + ((d.bed! - yMin) / (yMax - yMin)) * 110;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none" stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeLinecap="round"
                        />
                        <polyline
                          points={sleepMonthData.filter((d) => d.wake !== null).map((d) => {
                            const totalDays = daysInMonthUtil(sleepYear, sleepMonth);
                            const x = 30 + ((d.day - 1) / (totalDays - 1)) * 260;
                            const yMin = -4; const yMax = 12;
                            const y = 15 + ((d.wake! - yMin) / (yMax - yMin)) * 110;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth="1" strokeLinecap="round"
                        />
                      </>
                    )}
                    {/* X축 날짜 라벨 (5일 간격) */}
                    {[1, 5, 10, 15, 20, 25].map((d) => {
                      const totalDays = daysInMonthUtil(sleepYear, sleepMonth);
                      if (d > totalDays) return null;
                      const x = 30 + ((d - 1) / (totalDays - 1)) * 260;
                      return <text key={d} x={x} y={135} textAnchor="middle" fontSize="7" fill="#9ca3af">{d}일</text>;
                    })}
                  </svg>
                  <div className={styles.sleepChartLegend}>
                    <div className={styles.sleepLegendItem}>
                      <div className={styles.sleepLegendDot} style={{ background: "#6366f1" }} />
                      <span>취침</span>
                    </div>
                    <div className={styles.sleepLegendItem}>
                      <div className={styles.sleepLegendDot} style={{ background: "#f59e0b" }} />
                      <span>기상</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* ══ ❽ 위클리 솔루션 실천 현황 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🧘</span>
            <h2 className={styles.sectionTitle}>위클리 솔루션 실천 현황</h2>
          </div>

          <div className={styles.solutionStats}>
            <div className={styles.solutionStat}>
              <div className={styles.solutionStatValue}>
                {solutionSummary.currentWeek}<span className={styles.solutionStatUnit}>주차</span>
              </div>
              <div className={styles.solutionStatLabel}>현재 진행</div>
            </div>
            <div className={styles.solutionStat}>
              <div className={styles.solutionStatValue}>
                {solutionSummary.totalDays}<span className={styles.solutionStatUnit}>일</span>
              </div>
              <div className={styles.solutionStatLabel}>총 실천</div>
            </div>
          </div>

          {/* 주차별 진행 도트 */}
          {solutionSummary.currentWeek > 0 && (
            <div className={styles.solutionWeekProgress}>
              {Array.from({ length: Math.min(solutionSummary.currentWeek, 12) }).map((_, i) => {
                const weekNum = i + 1;
                const isCurrent = weekNum === solutionSummary.currentWeek;
                const isComplete = weekNum < solutionSummary.currentWeek;
                return (
                  <div
                    key={weekNum}
                    className={[
                      styles.weekDot,
                      isComplete ? styles.weekDotComplete : "",
                      isCurrent ? styles.weekDotCurrent : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {weekNum}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ══ ❾ 식습관 실천 그래프 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🥗</span>
            <h2 className={styles.sectionTitle}>습관 실천 그래프</h2>
            <span className={styles.sectionSub}>최근 4주</span>
          </div>

          {sleepLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <p className={styles.emptyText}>아직 습관 체크 기록이 없습니다.</p>
              <p className={styles.emptyHint}>위클리 해빗에서 습관을 체크하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <>
              {/* 스택 바 차트 */}
              <svg viewBox="0 0 280 120" className={styles.habitChartSvg} preserveAspectRatio="xMidYMid meet">
                {/* Y축 가이드 */}
                {[0, 2, 4, 6].map((v) => {
                  const y = 100 - (v / 7) * 80;
                  return (
                    <g key={v}>
                      <line x1="30" y1={y} x2="270" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
                      <text x="26" y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{v}</text>
                    </g>
                  );
                })}

                {/* 바 */}
                {habitChartData.map((week, wi) => {
                  const barX = 50 + wi * 58;
                  const barW = 36;
                  const habitColors = ["#22c55e", "#10b981", "#059669", "#047857", "#065f46", "#064e3b"];
                  let cumY = 100;

                  return (
                    <g key={wi}>
                      {habitItems.map((h, hi) => {
                        const val = week.habits[h] || 0;
                        const barH = (val / 7) * 80;
                        cumY -= barH;
                        return (
                          <rect
                            key={h}
                            x={barX}
                            y={cumY}
                            width={barW}
                            height={barH}
                            fill={habitColors[hi % habitColors.length]}
                            rx="2"
                            opacity="0.85"
                          />
                        );
                      })}
                      <text x={barX + barW / 2} y={112} textAnchor="middle" fontSize="7" fill="#9ca3af">{week.label}</text>
                    </g>
                  );
                })}
              </svg>

              <div className={styles.habitChartLegend}>
                {habitItems.slice(0, 5).map((h, i) => {
                  const colors = ["#22c55e", "#10b981", "#059669", "#047857", "#065f46"];
                  return (
                    <div key={h} className={styles.habitLegendItem}>
                      <div className={styles.habitLegendDot} style={{ background: colors[i % colors.length] }} />
                      <span className={styles.habitLegendText}>{h.length > 8 ? h.slice(0, 8) + "…" : h}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ══ ❿ 이해의 바다 실천 현황 ══ */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEmoji}>🌊</span>
            <h2 className={styles.sectionTitle}>이해의 바다 실천 현황</h2>
          </div>

          {seaSummary.totalSessions === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🧘‍♀️</div>
              <p className={styles.emptyText}>아직 이해의 바다 실천 기록이 없습니다.</p>
              <p className={styles.emptyHint}>이해의 바다에서 명상/몰입을 시작하면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className={styles.seaStats}>
              <div className={styles.seaStat}>
                <div className={styles.seaStatValue}>
                  {seaSummary.totalSessions}<span className={styles.seaStatUnit}>회</span>
                </div>
                <div className={styles.seaStatLabel}>총 이용 횟수</div>
              </div>
              <div className={styles.seaStat}>
                <div className={styles.seaStatValue}>
                  {Math.round(seaSummary.totalSessions * 15)}<span className={styles.seaStatUnit}>분</span>
                </div>
                <div className={styles.seaStatLabel}>예상 명상 시간</div>
              </div>
            </div>
          )}
        </section>

      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
