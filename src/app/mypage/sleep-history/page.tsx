"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import BottomTab from "@/components/BottomTab";
import * as storage from "@/lib/storage";
import styles from "./sleep-history.module.css";

interface PSQIResult {
  testDate: string;
  total: number;
  components: Record<string, number>;
  efficiency: number;
}

interface SleepLogItem {
  logKey: string;      // YYYY-MM-DD
  sleepTime: string;   // HH:MM
  wakeTime: string;    // HH:MM
  wakeCount?: number;  // 깬 횟수
  checkedHabits?: string[];  // 실천한 습관 이름 목록
  hadNap?: boolean;    // 낮잠 여부
  napStart?: string;   // HH:MM (낮잠 시작)
  napEnd?: string;     // HH:MM (낮잠 종료)
}

interface DayData {
  day: number;
  bedtimeDay: number;  // 취침 점을 찍을 실제 날 (저녁 취침이면 day-1)
  bedtime: number;
  wakeTime: number;
  sleepHours: number;
  wakeCount: number;
  bedtimeRaw: string;  // HH:MM 원본 (표 표시용)
  wakeTimeRaw: string; // HH:MM 원본 (표 표시용)
  hadNap: boolean;
  napStart: number | null;  // 소수 시간
  napEnd: number | null;    // 소수 시간
  napHours: number;         // 낮잠 시간
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

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/** HH:MM → 소수 시간 (취침: 18시 이후 음수 변환) */
function parseTimeToHour(hhmm: string, isBedtime: boolean): number | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const hour = h + m / 60;
  if (isBedtime && hour >= 18) return hour - 24;
  return hour;
}

/** 소수 시간 → "HH:MM" 표시 */
function hourToLabel(h: number): string {
  let hr = h < 0 ? h + 24 : h;
  const hh = Math.floor(hr);
  const mm = Math.round((hr - hh) * 60);
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

/** 월의 일수 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function SleepHistoryPage() {
  const router = useRouter();
  const [psqiResults, setPsqiResults] = useState<PSQIResult[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLogItem[]>([]);
  const [allSleepLogs, setAllSleepLogs] = useState<SleepLogItem[]>([]); // 습관용 (필터 없이)
  const [loading, setLoading] = useState(true);
  const [chartViewMode, setChartViewMode] = useState<"chart" | "table">("chart");
  const [patternViewMode, setPatternViewMode] = useState<"chart" | "table">("chart");
  const [habitItems, setHabitItems] = useState<string[]>([]);

  // 툴팁 hover 상태
  const [qualityHover, setQualityHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [patternHover, setPatternHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [habitHover, setHabitHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [durationHover, setDurationHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [napHover, setNapHover] = useState<{ x: number; y: number; label: string } | null>(null);

  // 수면 패턴 월 네비게이션
  const now = new Date();
  const [patternYear, setPatternYear] = useState(now.getFullYear());
  const [patternMonth, setPatternMonth] = useState(now.getMonth()); // 0-indexed

  const goPatternPrev = () => {
    if (patternMonth === 0) { setPatternYear((y) => y - 1); setPatternMonth(11); }
    else setPatternMonth((m) => m - 1);
  };
  const goPatternNext = () => {
    const cur = new Date(patternYear, patternMonth);
    const max = new Date(now.getFullYear(), now.getMonth());
    if (cur >= max) return; // 미래 월 이동 불가
    if (patternMonth === 11) { setPatternYear((y) => y + 1); setPatternMonth(0); }
    else setPatternMonth((m) => m + 1);
  };
  const isNextDisabled = patternYear === now.getFullYear() && patternMonth === now.getMonth();

  /* ── localStorage → AWS 수면 로그 마이그레이션 ── */
  const SLEEP_LOG_MIGRATED_KEY = "sleep_logs_migrated";
  const SLEEP_LOG_PREFIX = "weekly_habit_sleep_log_";

  async function migrateSleepLogs(authHeaders: Record<string, string>): Promise<void> {
    storage.migrateKey(SLEEP_LOG_MIGRATED_KEY);
    if (storage.get(SLEEP_LOG_MIGRATED_KEY) === "done") return;

    // 동적 키 레지스트리에서 수면 로그 키 수집 (localStorage 직접 열거 제거)
    const localLogs: { dateKey: string; data: Record<string, unknown> }[] = [];
    const entries = storage.getEntriesByPrefix(SLEEP_LOG_PREFIX);
    for (const { baseKey, value } of entries) {
      if (!value) continue;
      try {
        const dateKey = baseKey.replace(SLEEP_LOG_PREFIX, "");
        const parsed = JSON.parse(value);
        if (parsed.sleepTime || parsed.wakeTime) {
          localLogs.push({ dateKey, data: parsed });
        }
      } catch {}
    }

    if (localLogs.length === 0) {
      storage.set(SLEEP_LOG_MIGRATED_KEY, "done");
      return;
    }

    // AWS에 이미 있는 데이터 확인
    let existingKeys = new Set<string>();
    try {
      const res = await fetch("/api/user/sleep-log", { method: "GET", cache: "no-store", headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        const items: SleepLogItem[] = data.items || [];
        existingKeys = new Set(items.map((it) => it.logKey));
      }
    } catch {}

    // AWS에 없는 로그만 마이그레이션
    const toMigrate = localLogs.filter((l) => !existingKeys.has(l.dateKey));
    if (toMigrate.length === 0) {
      storage.set(SLEEP_LOG_MIGRATED_KEY, "done");
      return;
    }

    const results = await Promise.allSettled(
      toMigrate.map((item) =>
        fetch("/api/user/sleep-log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            date: item.dateKey,
            sleepTime: item.data.sleepTime,
            wakeTime: item.data.wakeTime,
            wakeCount: item.data.wakeCount,
            hadDream: item.data.hadDream,
            locked: item.data.locked,
            hadNap: item.data.hadNap,
            napStart: item.data.napStart,
            napEnd: item.data.napEnd,
            sleepMood: item.data.sleepMood,
            sleepNote: item.data.sleepNote,
            checkedHabits: item.data.checkedHabits,
          }),
        })
      )
    );

    const allSucceeded = results.every(
      (r) => r.status === "fulfilled" && r.value.ok
    );
    if (allSucceeded) {
      storage.set(SLEEP_LOG_MIGRATED_KEY, "done");
    } else {
      console.warn("수면 로그 마이그레이션 일부 실패 — 다음 방문 시 재시도");
    }
  }

  /* ── 데이터 fetch (독립) ── */
  useEffect(() => {
    let done = 0;
    const checkDone = () => { done++; if (done >= 3) setLoading(false); };
    const userToken = storage.getRaw("user_id_token");
    const authHeaders: Record<string, string> = userToken ? { Authorization: `Bearer ${userToken}` } : {};

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

    (async () => {
      try {
        // 마이그레이션 먼저 실행 (old localStorage → AWS)
        await migrateSleepLogs(authHeaders);
        // 마이그레이션 후 AWS에서 데이터 조회
        const res = await fetch("/api/user/sleep-log", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const allItems: SleepLogItem[] = (data.items || []);
          allItems.sort((a: SleepLogItem, b: SleepLogItem) => a.logKey.localeCompare(b.logKey));
          setAllSleepLogs(allItems); // 습관 차트용 (전체)
          const filtered = allItems.filter(
            (it: SleepLogItem) => it.sleepTime && it.wakeTime
          );
          setSleepLogs(filtered); // 수면 패턴 차트용
        }
      } catch (err) { console.error("수면 로그 조회 실패:", err); }
      finally { checkDone(); }
    })();

    (async () => {
      let found = false;
      try {
        // 1) API에서 습관 설정 조회 (응답: { item: { habitItems: [...], startDate } })
        const res = await fetch("/api/user/sleep-log/config", { method: "GET", cache: "no-store", headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          const items: string[] = data.item?.habitItems || data.habitItems || [];
          if (items.length > 0) { setHabitItems(items); found = true; }
        }
      } catch (err) {
        console.error("습관 설정 조회 실패:", err);
      }
      // 2) API에 없으면 storage 폴백
      if (!found) {
        try {
          storage.migrateKey("weekly_habit_custom_items");
          const saved = storage.get("weekly_habit_custom_items");
          if (saved) {
            const items: string[] = JSON.parse(saved);
            if (items.length > 0) { setHabitItems(items); found = true; }
          }
        } catch {}
      }
      // 3) 둘 다 없으면 sleep-log의 checkedHabits에서 추출
      if (!found) {
        try {
          const logRes = await fetch("/api/user/sleep-log", { method: "GET", cache: "no-store", headers: authHeaders });
          if (logRes.ok) {
            const logData = await logRes.json();
            const allLogs: SleepLogItem[] = logData.items || [];
            const nameSet = new Set<string>();
            allLogs.forEach((l) => l.checkedHabits?.forEach((h) => nameSet.add(h)));
            if (nameSet.size > 0) { setHabitItems([...nameSet]); found = true; }
          }
        } catch {}
      }
      // 4) 모든 소스에 없으면 PSQITest와 동일한 기본값 사용
      if (!found) {
        setHabitItems(["핸드폰 멀리두고 자기"]);
      }
      checkDone();
    })();
  }, []);

  // 12개월 기준 차트 데이터 계산
  const chartInfo = useMemo(() => {
    if (psqiResults.length === 0) return null;

    const latestDate = new Date(psqiResults[psqiResults.length - 1].testDate);
    const baseYear = latestDate.getFullYear();
    const baseMonth = latestDate.getMonth();

    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = baseMonth - i;
      let y = baseYear;
      while (m < 0) { m += 12; y -= 1; }
      months.push({ year: y, month: m, label: MONTH_LABELS[m] });
    }

    const monthlyData: (PSQIResult | null)[] = months.map(({ year, month }) => {
      const matching = psqiResults.filter((r) => {
        const d = new Date(r.testDate);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      return matching.length > 0 ? matching[matching.length - 1] : null;
    });

    return { months, monthlyData };
  }, [psqiResults]);

  /* ── 수면 패턴: 선택된 월의 일별 데이터 ── */
  const patternDays = useMemo((): DayData[] => {
    const totalDays = daysInMonth(patternYear, patternMonth);
    const result: DayData[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const key = `${patternYear}-${String(patternMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const log = sleepLogs.find((l) => l.logKey === key);
      if (!log) continue;
      const bed = parseTimeToHour(log.sleepTime, true);
      const wake = parseTimeToHour(log.wakeTime, false);
      if (bed === null || wake === null) continue;
      const sleepH = wake - bed;
      if (sleepH <= 0 || sleepH > 16) continue;
      // 저녁 취침(18시 이후)이면 전날에 점 찍기, 자정 이후면 당일에 점 찍기
      const [bH] = log.sleepTime.split(":").map(Number);
      const bedtimeDay = bH >= 18 ? d - 1 : d;
      // 낮잠 파싱
      const hadNap = log.hadNap ?? false;
      const napStartH = hadNap && log.napStart ? parseTimeToHour(log.napStart, false) : null;
      const napEndH = hadNap && log.napEnd ? parseTimeToHour(log.napEnd, false) : null;
      const napHours = napStartH !== null && napEndH !== null && napEndH > napStartH
        ? Math.round((napEndH - napStartH) * 10) / 10 : 0;
      result.push({ day: d, bedtimeDay, bedtime: bed, wakeTime: wake, sleepHours: Math.round(sleepH * 10) / 10, wakeCount: log.wakeCount ?? 0, bedtimeRaw: log.sleepTime, wakeTimeRaw: log.wakeTime, hadNap, napStart: napStartH, napEnd: napEndH, napHours });
    }
    return result;
  }, [sleepLogs, patternYear, patternMonth]);

  // 수면 패턴 Y축 범위
  const patternYRange = useMemo(() => {
    if (patternDays.length === 0) return { min: -2, max: 10 };
    let mn = 0, mx = 10;
    patternDays.forEach((d) => {
      if (d.bedtime < mn) mn = d.bedtime;
      if (d.wakeTime > mx) mx = d.wakeTime;
    });
    return { min: Math.floor(mn) - 1, max: Math.ceil(mx) + 1 };
  }, [patternDays]);

  /* ── 수면 습관: 선택된 월의 일별 실천 데이터 ── */
  const habitChartData = useMemo(() => {
    if (habitItems.length === 0) return null;

    const totalDays = daysInMonth(patternYear, patternMonth);
    // 각 습관별로 실천한 날(day number) 배열
    const habitMap: Record<string, number[]> = {};
    habitItems.forEach((name) => { habitMap[name] = []; });

    for (let d = 1; d <= totalDays; d++) {
      const key = `${patternYear}-${String(patternMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const log = allSleepLogs.find((l) => l.logKey === key);
      if (!log || !log.checkedHabits) continue;
      log.checkedHabits.forEach((habit) => {
        if (habitMap[habit]) habitMap[habit].push(d);
      });
    }

    return { totalDays, habitMap };
  }, [allSleepLogs, habitItems, patternYear, patternMonth]);

  // 차트 치수
  const chartW = 360;
  const chartH = 240;
  const padL = 32;
  const padR = 12;
  const padT = 20;
  const padB = 32;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  // Y축: 0~10, 2점 단위
  const yTicks = [0, 2, 4, 6, 8, 10];

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.headerTitle}>나의 수면 기록</h1>
        <div className={styles.headerSpacer} />
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <p className={styles.loadingText}>불러오는 중...</p>
          </div>
        ) : psqiResults.length === 0 && sleepLogs.length === 0 ? (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyIcon}>😴</p>
            <p className={styles.emptyText}>아직 수면 기록이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* ── 1. 수면의 질 그래프 ── */}
            {chartInfo && (
              <section className={styles.chartSection}>
                <div className={styles.chartHeader}>
                  <div className={styles.chartTitleWrap}>
                    <h2 className={styles.sectionTitle}>수면의 질</h2>
                    <p className={styles.sectionDesc}>점수가 높을수록 수면의 질이 좋습니다</p>
                  </div>
                  <button
                    className={styles.viewToggleBtn}
                    onClick={() => setChartViewMode((v) => v === "chart" ? "table" : "chart")}
                  >
                    {chartViewMode === "chart" ? "표로 보기" : "차트로 보기"}
                  </button>
                </div>

                {chartViewMode === "chart" ? (
                <>
                <div className={styles.chartBox}>
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className={styles.chart}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* 등급 배경 구간 */}
                    <rect x={padL} y={padT} width={innerW} height={innerH * 0.35} fill="rgba(16,185,129,0.06)" />
                    <rect x={padL} y={padT + innerH * 0.35} width={innerW} height={innerH * 0.25} fill="rgba(245,158,11,0.06)" />
                    <rect x={padL} y={padT + innerH * 0.6} width={innerW} height={innerH * 0.2} fill="rgba(249,115,22,0.05)" />
                    <rect x={padL} y={padT + innerH * 0.8} width={innerW} height={innerH * 0.2} fill="rgba(239,68,68,0.04)" />

                    {/* Y축 가로선 + 라벨 */}
                    {yTicks.map((v) => {
                      const y = padT + (1 - v / 10) * innerH;
                      return (
                        <g key={`y-${v}`}>
                          <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke={v === 0 ? "rgba(107,114,128,0.3)" : "rgba(229,231,235,0.8)"} strokeWidth={v === 0 ? 1 : 0.5} />
                          <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="500" fill="rgba(107,114,128,0.6)">{v}</text>
                        </g>
                      );
                    })}

                    {/* X축 세로선 + 월 라벨 (12개월) */}
                    {chartInfo.months.map((m, i) => {
                      const x = padL + (i / 11) * innerW;
                      return (
                        <g key={`x-${i}`}>
                          <line x1={x} y1={padT} x2={x} y2={padT + innerH} stroke="rgba(229,231,235,0.5)" strokeWidth="0.5" />
                          <text x={x} y={chartH - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="rgba(107,114,128,0.7)">{m.label}</text>
                        </g>
                      );
                    })}

                    {/* 연결선 */}
                    {(() => {
                      const points: string[] = [];
                      chartInfo.monthlyData.forEach((r, i) => {
                        if (r) {
                          const x = padL + (i / 11) * innerW;
                          const y = padT + (1 - toScore10(r.total) / 10) * innerH;
                          points.push(`${x},${y}`);
                        }
                      });
                      if (points.length < 2) return null;
                      return (
                        <polyline points={points.join(" ")} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                      );
                    })()}

                    {/* 데이터 포인트 */}
                    {chartInfo.monthlyData.map((r, i) => {
                      if (!r) return null;
                      const x = padL + (i / 11) * innerW;
                      const score = toScore10(r.total);
                      const y = padT + (1 - score / 10) * innerH;
                      const q = getPSQIQualityLabel(r.total);
                      const isLatest = i === chartInfo.monthlyData.length - 1 ||
                        chartInfo.monthlyData.slice(i + 1).every((d) => d === null);
                      const dateLabel = formatFullDate(r.testDate);
                      return (
                        <g key={`pt-${i}`}
                          onMouseEnter={() => setQualityHover({ x, y, label: dateLabel })}
                          onMouseLeave={() => setQualityHover(null)}
                          style={{ cursor: "pointer" }}
                        >
                          <circle cx={x} cy={y} r={isLatest ? 6 : 4.5} fill={q.color} stroke="#ffffff" strokeWidth="2" />
                          <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={q.color}>{score}</text>
                          {/* 투명한 히트 영역 확대 */}
                          <circle cx={x} cy={y} r={12} fill="transparent" />
                        </g>
                      );
                    })}

                    {/* 날짜 툴팁 */}
                    {qualityHover && (() => {
                      const tw = 80;
                      const tx = Math.max(tw / 2, Math.min(qualityHover.x, chartW - tw / 2));
                      return (
                        <g>
                          <rect x={tx - tw / 2} y={qualityHover.y - 32} width={tw} height={18} rx={4} fill="rgba(55,65,81,0.92)" />
                          <polygon points={`${qualityHover.x - 4},${qualityHover.y - 14} ${qualityHover.x + 4},${qualityHover.y - 14} ${qualityHover.x},${qualityHover.y - 9}`} fill="rgba(55,65,81,0.92)" />
                          <text x={tx} y={qualityHover.y - 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ffffff">{qualityHover.label}</text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                <div className={styles.legend}>
                  <span style={{ color: "#059669" }}>S 최상</span>
                  <span style={{ color: "#10b981" }}>A 양호</span>
                  <span style={{ color: "#f59e0b" }}>B 보통</span>
                  <span style={{ color: "#f97316" }}>C 미흡</span>
                  <span style={{ color: "#ef4444" }}>D 불량</span>
                  <span style={{ color: "#dc2626" }}>F 매우 불량</span>
                </div>
                </>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>날짜</th>
                          <th className={styles.th}>점수</th>
                          <th className={styles.th}>등급</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...psqiResults].reverse().map((r) => {
                          const q = getPSQIQualityLabel(r.total);
                          return (
                            <tr key={r.testDate} className={styles.tr}>
                              <td className={styles.td}>{formatFullDate(r.testDate)}</td>
                              <td className={styles.tdScore} style={{ color: q.color }}>{toScore10(r.total)}</td>
                              <td className={styles.td}>
                                <span className={styles.tableGrade} style={{ background: q.color }}>{q.grade}</span>
                                <span className={styles.tableLabel} style={{ color: q.color }}>{q.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ── 2. 수면 패턴 (듀얼밴드 — 일별, 월 단위 네비게이션) ── */}
            {(() => {
              const hasAnyNap = patternDays.some((dd) => dd.napHours > 0);
              const napRowH = hasAnyNap ? 24 : 0;
              const spW = 380;
              const spH = 280 + napRowH;
              const spPadL = 44;
              const spPadR = 16;
              const spPadT = 20 + napRowH;
              const spPadB = 36;
              const spInnerW = spW - spPadL - spPadR;
              const spInnerH = spH - spPadT - spPadB;
              const range = patternYRange.max - patternYRange.min;
              const totalDays = daysInMonth(patternYear, patternMonth);

              const toY = (hour: number) => spPadT + ((patternYRange.max - hour) / range) * spInnerH;
              const toX = (day: number) => spPadL + ((day - 1) / (totalDays - 1)) * spInnerW;

              // Y축 눈금: 2시간 단위
              const spYTicks: number[] = [];
              for (let t = Math.ceil(patternYRange.min); t <= Math.floor(patternYRange.max); t += 2) {
                spYTicks.push(t);
              }

              // X축 눈금: 5일 간격 + 마지막 날
              const xTicks: number[] = [];
              for (let d = 1; d <= totalDays; d += 5) xTicks.push(d);
              if (xTicks[xTicks.length - 1] !== totalDays) xTicks.push(totalDays);

              // 연속 세그먼트 (밴드 면적용) — 취침점은 bedtimeDay, 기상점은 day
              interface Pt { x: number; y: number }
              interface Seg { bedPts: Pt[]; wakePts: Pt[] }
              const segments: Seg[] = [];
              let curSeg: Seg | null = null;

              for (let d = 1; d <= totalDays; d++) {
                const dd = patternDays.find((pd) => pd.day === d);
                if (dd) {
                  if (!curSeg) curSeg = { bedPts: [], wakePts: [] };
                  curSeg.bedPts.push({ x: toX(dd.bedtimeDay), y: toY(dd.bedtime) });
                  curSeg.wakePts.push({ x: toX(dd.day), y: toY(dd.wakeTime) });
                } else {
                  if (curSeg) { segments.push(curSeg); curSeg = null; }
                }
              }
              if (curSeg) segments.push(curSeg);

              return (
                <section className={styles.chartSection}>
                  {/* 헤더 */}
                  <div className={styles.chartHeader}>
                    <div className={styles.chartTitleWrap}>
                      <h2 className={styles.sectionTitle}>수면 패턴</h2>
                    </div>
                    <button
                      className={styles.viewToggleBtn}
                      onClick={() => setPatternViewMode((v) => v === "chart" ? "table" : "chart")}
                    >
                      {patternViewMode === "chart" ? "표로 보기" : "차트로 보기"}
                    </button>
                  </div>

                  <div className={styles.monthNav}>
                    <button className={styles.monthNavBtn} onClick={goPatternPrev} aria-label="이전 월">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className={styles.monthNavLabel}>{patternYear}년 {patternMonth + 1}월</span>
                    <button className={styles.monthNavBtn} onClick={goPatternNext} disabled={isNextDisabled} aria-label="다음 월" style={{ opacity: isNextDisabled ? 0.3 : 1 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    </button>
                  </div>

                  {patternDays.length === 0 ? (
                    <div className={styles.emptyWrap} style={{ padding: "30px 0" }}>
                      <p className={styles.emptyText}>이 달의 수면 기록이 없습니다.</p>
                    </div>
                  ) : patternViewMode === "chart" ? (
                    <>
                    <div className={styles.chartBox}>
                      <svg viewBox={`0 0 ${spW} ${spH}`} className={styles.sleepChart} style={hasAnyNap ? { aspectRatio: `${spW} / ${spH}` } : undefined} preserveAspectRatio="xMidYMid meet">
                        {/* 배경 */}
                        <rect x={spPadL} y={spPadT} width={spInnerW} height={spInnerH} fill="rgba(99,102,241,0.03)" rx="4" />

                        {/* Y축 */}
                        {spYTicks.map((t) => {
                          const y = toY(t);
                          return (
                            <g key={`spy-${t}`}>
                              <line x1={spPadL} y1={y} x2={spPadL + spInnerW} y2={y} stroke="rgba(229,231,235,0.7)" strokeWidth="0.5" />
                              <text x={spPadL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fontWeight="500" fill="rgba(107,114,128,0.6)">{hourToLabel(t)}</text>
                            </g>
                          );
                        })}

                        {/* X축 일 라벨 */}
                        {xTicks.map((d) => {
                          const x = toX(d);
                          return (
                            <g key={`spx-${d}`}>
                              <line x1={x} y1={spPadT} x2={x} y2={spPadT + spInnerH} stroke="rgba(229,231,235,0.4)" strokeWidth="0.5" />
                              <text x={x} y={spH - 10} textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(107,114,128,0.7)">{d}일</text>
                            </g>
                          );
                        })}

                        {/* 낮잠 마커 (차트 상단 여백) */}
                        {hasAnyNap && patternDays.filter((dd) => dd.napHours > 0).map((dd) => {
                          const napDay = dd.day - 1 < 1 ? dd.day : dd.day - 1;
                          const x = toX(napDay);
                          const markerY = 12;
                          const napLabel = `${patternMonth + 1}/${napDay} 낮잠 ${dd.napHours}h`;
                          return (
                            <g key={`nap-marker-${dd.day}`}>
                              <circle cx={x} cy={markerY} r="3.5" fill="#38bdf8" />
                              <text x={x} y={markerY + 12} textAnchor="middle" fontSize="7" fontWeight="600" fill="#38bdf8">
                                {dd.napHours}h
                              </text>
                              <circle
                                cx={x} cy={markerY} r="10" fill="transparent"
                                onMouseEnter={() => setNapHover({ x, y: markerY, label: napLabel })}
                                onMouseLeave={() => setNapHover(null)}
                              />
                            </g>
                          );
                        })}

                        {/* 낮잠 마커 툴팁 */}
                        {napHover && (() => {
                          const tw = napHover.label.length * 6 + 16;
                          const tx = Math.max(tw / 2, Math.min(napHover.x, spW - tw / 2));
                          const tipTop = napHover.y + 18;
                          return (
                            <g>
                              <polygon points={`${napHover.x - 4},${tipTop} ${napHover.x + 4},${tipTop} ${napHover.x},${tipTop - 5}`} fill="rgba(55,65,81,0.92)" />
                              <rect x={tx - tw / 2} y={tipTop} width={tw} height={18} rx={4} fill="rgba(55,65,81,0.92)" />
                              <text x={tx} y={tipTop + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ffffff">{napHover.label}</text>
                            </g>
                          );
                        })()}

                        {/* 밴드 면적 + 선 */}
                        {segments.map((seg, si) => {
                          if (seg.bedPts.length === 1) {
                            // 단일 기록: 취침→기상 사이 면적 (취침/기상 x가 다를 수 있음)
                            const bw = 3;
                            return (
                              <g key={`seg-${si}`}>
                                <polygon
                                  points={`${seg.wakePts[0].x - bw},${seg.wakePts[0].y} ${seg.wakePts[0].x + bw},${seg.wakePts[0].y} ${seg.bedPts[0].x + bw},${seg.bedPts[0].y} ${seg.bedPts[0].x - bw},${seg.bedPts[0].y}`}
                                  fill="rgba(99,102,241,0.18)"
                                />
                              </g>
                            );
                          }
                          const areaPath = [
                            `M ${seg.wakePts[0].x},${seg.wakePts[0].y}`,
                            ...seg.wakePts.slice(1).map((p) => `L ${p.x},${p.y}`),
                            ...seg.bedPts.slice().reverse().map((p) => `L ${p.x},${p.y}`),
                            "Z",
                          ].join(" ");
                          return (
                            <g key={`seg-${si}`}>
                              <path d={areaPath} fill="rgba(99,102,241,0.18)" />
                              <polyline points={seg.wakePts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={seg.bedPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                          );
                        })}

                        {/* 데이터 포인트 + 수면시간 라벨 */}
                        {(() => {
                          // 수면시간 라벨 y 위치: 높을수록 위에 (밴드 내부에서 비례 배치)
                          const allHours = patternDays.map((d) => d.sleepHours);
                          const minH = Math.min(...allHours);
                          const maxH = Math.max(...allHours);
                          const hRange = maxH - minH;

                          return patternDays.map((dd) => {
                            const bedX = toX(dd.bedtimeDay);
                            const wakeX = toX(dd.day);
                            const bedY = toY(dd.bedtime);
                            const wakeY = toY(dd.wakeTime);
                            const midX = (bedX + wakeX) / 2;
                            // 수면시간이 높을수록 wakeY(위)에 가깝게, 낮을수록 bedY(아래)에 가깝게
                            const t = hRange > 0 ? (dd.sleepHours - minH) / hRange : 0.5;
                            const labelY = bedY + (wakeY - bedY) * (0.3 + t * 0.4);
                            const dateLabel = `${patternMonth + 1}/${dd.day}`;
                            const hitMinX = Math.min(bedX, wakeX) - 8;
                            const hitMaxX = Math.max(bedX, wakeX) + 8;
                            return (
                              <g key={`spt-${dd.day}`}
                                onMouseEnter={() => setPatternHover({ x: wakeX, y: wakeY, label: dateLabel })}
                                onMouseLeave={() => setPatternHover(null)}
                                style={{ cursor: "pointer" }}
                              >
                                <circle cx={wakeX} cy={wakeY} r={3} fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                                <circle cx={bedX} cy={bedY} r={3} fill="#6366f1" stroke="#fff" strokeWidth="1" />
                                <text x={midX} y={labelY + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="rgba(99,102,241,0.6)">
                                  {dd.sleepHours}h
                                </text>
                                <rect x={hitMinX} y={wakeY - 5} width={hitMaxX - hitMinX} height={bedY - wakeY + 10} fill="transparent" />
                              </g>
                            );
                          });
                        })()}

                        {/* 날짜 툴팁 */}
                        {patternHover && (() => {
                          const tw = 48;
                          const tx = Math.max(tw / 2, Math.min(patternHover.x, spW - tw / 2));
                          return (
                            <g>
                              <rect x={tx - tw / 2} y={patternHover.y - 28} width={tw} height={18} rx={4} fill="rgba(55,65,81,0.92)" />
                              <polygon points={`${patternHover.x - 4},${patternHover.y - 10} ${patternHover.x + 4},${patternHover.y - 10} ${patternHover.x},${patternHover.y - 5}`} fill="rgba(55,65,81,0.92)" />
                              <text x={tx} y={patternHover.y - 16} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ffffff">{patternHover.label}</text>
                            </g>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* 범례 */}
                    <div className={styles.legend} style={{ marginTop: 6, paddingTop: 5, marginBottom: 0 }}>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: "#6366f1" }} />
                        취침시각
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: "#f59e0b" }} />
                        기상시각
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: "rgba(99,102,241,0.15)" }} />
                        수면시간
                      </span>
                      {hasAnyNap && (
                        <span className={styles.legendItem}>
                          <span className={styles.legendDot} style={{ background: "#38bdf8" }} />
                          낮잠
                        </span>
                      )}
                    </div>

                    {/* ── 총 수면시간 차트 ── */}
                    {(() => {
                      const durW = spW;
                      const durH = 200;
                      const durPadL = spPadL;
                      const durPadR = spPadR;
                      const durPadT = 20;
                      const durPadB = 36;
                      const durInnerW = durW - durPadL - durPadR;
                      const durInnerH = durH - durPadT - durPadB;

                      // Y축 범위: 0 ~ 최대 수면시간 (최소 10h)
                      const maxSleep = Math.max(10, ...patternDays.map((d) => d.sleepHours));
                      const durYMax = Math.ceil(maxSleep);

                      const toDurX = (day: number) => durPadL + ((day - 1) / (totalDays - 1)) * durInnerW;
                      const toDurY = (h: number) => durPadT + (1 - h / durYMax) * durInnerH;

                      // Y축 눈금 (2h 간격)
                      const durYTicks: number[] = [];
                      for (let t = 0; t <= durYMax; t += 2) durYTicks.push(t);

                      // 포인트 + 연결선
                      const pts = patternDays.map((dd) => ({
                        x: toDurX(dd.day),
                        y: toDurY(dd.sleepHours),
                        day: dd.day,
                        hours: dd.sleepHours,
                      }));

                      // 면적 채우기 경로
                      const areaPath = pts.length >= 2
                        ? [
                            `M ${pts[0].x},${toDurY(0)}`,
                            `L ${pts[0].x},${pts[0].y}`,
                            ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
                            `L ${pts[pts.length - 1].x},${toDurY(0)}`,
                            "Z",
                          ].join(" ")
                        : null;

                      return (
                        <div className={styles.chartBox} style={{ marginTop: 3 }}>
                          <svg viewBox={`0 0 ${durW} ${durH}`} className={styles.durationChart} preserveAspectRatio="xMidYMid meet">
                            {/* 배경 */}
                            <rect x={durPadL} y={durPadT} width={durInnerW} height={durInnerH} fill="rgba(16,185,129,0.03)" rx="4" />

                            {/* Y축 가로선 + 라벨 */}
                            {durYTicks.map((t) => {
                              const y = toDurY(t);
                              return (
                                <g key={`dy-${t}`}>
                                  <line x1={durPadL} y1={y} x2={durPadL + durInnerW} y2={y} stroke={t === 0 ? "rgba(107,114,128,0.3)" : "rgba(229,231,235,0.7)"} strokeWidth={t === 0 ? 1 : 0.5} />
                                  <text x={durPadL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fontWeight="500" fill="rgba(107,114,128,0.6)">{t}h</text>
                                </g>
                              );
                            })}

                            {/* X축 눈금 (상위 차트와 동일) */}
                            {xTicks.map((d) => {
                              const x = toDurX(d);
                              return (
                                <g key={`dx-${d}`}>
                                  <line x1={x} y1={durPadT} x2={x} y2={durPadT + durInnerH} stroke="rgba(229,231,235,0.4)" strokeWidth="0.5" />
                                  <text x={x} y={durH - 10} textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(107,114,128,0.7)">{d}일</text>
                                </g>
                              );
                            })}

                            {/* 면적 채우기 */}
                            {areaPath && <path d={areaPath} fill="rgba(16,185,129,0.1)" />}

                            {/* 연결선 */}
                            {pts.length >= 2 && (
                              <polyline
                                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}

                            {/* 데이터 포인트 */}
                            {pts.map((p) => {
                              const dateLabel = `${patternMonth + 1}/${p.day}`;
                              return (
                                <g key={`dur-${p.day}`}
                                  onMouseEnter={() => setDurationHover({ x: p.x, y: p.y, label: `${dateLabel} · ${p.hours}h` })}
                                  onMouseLeave={() => setDurationHover(null)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <circle cx={p.x} cy={p.y} r={3.5} fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                                  <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fontWeight="700" fill="#10b981">{p.hours}</text>
                                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                                </g>
                              );
                            })}

                            {/* 날짜 툴팁 */}
                            {durationHover && (() => {
                              const tw = 68;
                              const tx = Math.max(tw / 2, Math.min(durationHover.x, durW - tw / 2));
                              return (
                                <g>
                                  <rect x={tx - tw / 2} y={durationHover.y - 32} width={tw} height={18} rx={4} fill="rgba(55,65,81,0.92)" />
                                  <polygon points={`${durationHover.x - 4},${durationHover.y - 14} ${durationHover.x + 4},${durationHover.y - 14} ${durationHover.x},${durationHover.y - 9}`} fill="rgba(55,65,81,0.92)" />
                                  <text x={tx} y={durationHover.y - 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ffffff">{durationHover.label}</text>
                                </g>
                              );
                            })()}
                          </svg>
                        </div>
                      );
                    })()}

                    <div className={styles.legend} style={{ marginTop: 4, paddingTop: 4 }}>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: "#10b981" }} />
                        총 수면시간
                      </span>
                    </div>
                    </>
                  ) : (
                    /* 테이블 뷰 */
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>날짜</th>
                            <th className={styles.th} style={{ color: "#6366f1" }}>취침</th>
                            <th className={styles.th} style={{ color: "#f59e0b" }}>기상</th>
                            <th className={styles.th}>수면</th>
                            <th className={styles.th}>깬 횟수</th>
                            <th className={styles.th}>낮잠 시간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patternDays.map((dd) => (
                            <tr key={dd.day} className={styles.tr}>
                              <td className={styles.td}>{patternMonth + 1}/{dd.day}</td>
                              <td className={styles.td} style={{ color: "#6366f1", fontWeight: 600 }}>{dd.bedtimeRaw}</td>
                              <td className={styles.td} style={{ color: "#f59e0b", fontWeight: 600 }}>{dd.wakeTimeRaw}</td>
                              <td className={styles.tdScore} style={{ color: "#6366f1" }}>{dd.sleepHours}h</td>
                              <td className={styles.td}>{dd.wakeCount}회</td>
                              <td className={styles.td} style={{ color: dd.napHours > 0 ? "#38bdf8" : undefined }}>
                                {dd.napHours > 0 ? `${dd.napHours}h` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── 3. 수면 습관 (dot-line 차트) ── */}
            {habitChartData && habitItems.length > 0 && (() => {
              const { totalDays, habitMap } = habitChartData;
              const habitCount = habitItems.length;

              // 습관 이름 축약 (4글자 이내)
              const abbreviate = (name: string): string => {
                if (name.length <= 4) return name;
                return name.slice(0, 4) + "…";
              };

              // 차트 치수
              const hcPadL = 64;
              const hcPadR = 12;
              const hcPadT = 12;
              const hcPadB = 28;
              const rowH = 36;
              const hcW = 380;
              const hcH = hcPadT + rowH * habitCount + hcPadB;
              const hcInnerW = hcW - hcPadL - hcPadR;

              const toHcX = (day: number) => hcPadL + ((day - 1) / (totalDays - 1)) * hcInnerW;
              const toHcY = (idx: number) => hcPadT + idx * rowH + rowH / 2;

              // X축 눈금
              const hcXTicks: number[] = [];
              for (let d = 1; d <= totalDays; d += 5) hcXTicks.push(d);
              if (hcXTicks[hcXTicks.length - 1] !== totalDays) hcXTicks.push(totalDays);

              return (
                <section className={styles.chartSection}>
                  <div className={styles.chartHeader}>
                    <div className={styles.chartTitleWrap}>
                      <h2 className={styles.sectionTitle}>수면 습관</h2>
                    </div>
                  </div>

                  {/* 월 네비게이션 (수면 패턴과 공유) */}
                  <div className={styles.monthNav}>
                    <button className={styles.monthNavBtn} onClick={goPatternPrev} aria-label="이전 월">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className={styles.monthNavLabel}>{patternYear}년 {patternMonth + 1}월</span>
                    <button className={styles.monthNavBtn} onClick={goPatternNext} disabled={isNextDisabled} aria-label="다음 월" style={{ opacity: isNextDisabled ? 0.3 : 1 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    </button>
                  </div>

                  <div className={styles.chartBox}>
                    <svg viewBox={`0 0 ${hcW} ${hcH}`} className={styles.habitChart} preserveAspectRatio="xMidYMid meet">
                      {/* 배경 행 줄무늬 */}
                      {habitItems.map((_, idx) => (
                        <rect
                          key={`hbg-${idx}`}
                          x={hcPadL}
                          y={hcPadT + idx * rowH}
                          width={hcInnerW}
                          height={rowH}
                          fill={idx % 2 === 0 ? "rgba(99,102,241,0.03)" : "rgba(99,102,241,0.06)"}
                        />
                      ))}

                      {/* X축 세로 가이드선 + 일 라벨 */}
                      {hcXTicks.map((d) => {
                        const x = toHcX(d);
                        return (
                          <g key={`hcx-${d}`}>
                            <line x1={x} y1={hcPadT} x2={x} y2={hcPadT + rowH * habitCount} stroke="rgba(229,231,235,0.5)" strokeWidth="0.5" />
                            <text x={x} y={hcH - 8} textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(107,114,128,0.7)">{d}일</text>
                          </g>
                        );
                      })}

                      {/* 습관 이름 (Y축 라벨) */}
                      {habitItems.map((name, idx) => (
                        <text
                          key={`hlbl-${idx}`}
                          x={hcPadL - 6}
                          y={toHcY(idx) + 3.5}
                          textAnchor="end"
                          fontSize="10"
                          fontWeight="600"
                          fill="#4b5563"
                        >
                          {abbreviate(name)}
                        </text>
                      ))}

                      {/* 각 습관별 연결선 + 점 */}
                      {habitItems.map((name, idx) => {
                        const days = habitMap[name] || [];
                        if (days.length === 0) return null;
                        const color = [
                          "#6366f1", "#f59e0b", "#10b981", "#ef4444",
                          "#8b5cf6", "#ec4899", "#06b6d4",
                        ][idx % 7];

                        const lineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
                        const sortedDays = [...days].sort((a, b) => a - b);
                        for (let i = 0; i < sortedDays.length - 1; i++) {
                          lineSegments.push({
                            x1: toHcX(sortedDays[i]),
                            y1: toHcY(idx),
                            x2: toHcX(sortedDays[i + 1]),
                            y2: toHcY(idx),
                          });
                        }

                        return (
                          <g key={`habit-${idx}`}>
                            {lineSegments.map((seg, si) => (
                              <line
                                key={`hline-${idx}-${si}`}
                                x1={seg.x1} y1={seg.y1}
                                x2={seg.x2} y2={seg.y2}
                                stroke={color}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                opacity="0.5"
                              />
                            ))}
                            {sortedDays.map((d) => {
                              const cx = toHcX(d);
                              const cy = toHcY(idx);
                              const dateLabel = `${patternMonth + 1}/${d}`;
                              return (
                                <g key={`hdot-${idx}-${d}`}
                                  onMouseEnter={() => setHabitHover({ x: cx, y: cy, label: dateLabel })}
                                  onMouseLeave={() => setHabitHover(null)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth="1" />
                                  <circle cx={cx} cy={cy} r={10} fill="transparent" />
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}

                      {/* 날짜 툴팁 */}
                      {habitHover && (() => {
                        const tw = 48;
                        const tx = Math.max(tw / 2, Math.min(habitHover.x, hcW - tw / 2));
                        const ty = habitHover.y - 22;
                        return (
                          <g>
                            <rect x={tx - tw / 2} y={ty} width={tw} height={18} rx={4} fill="rgba(55,65,81,0.92)" />
                            <polygon points={`${habitHover.x - 4},${ty + 18} ${habitHover.x + 4},${ty + 18} ${habitHover.x},${ty + 23}`} fill="rgba(55,65,81,0.92)" />
                            <text x={tx} y={ty + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ffffff">{habitHover.label}</text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                </section>
              );
            })()}

          </>
        )}
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
