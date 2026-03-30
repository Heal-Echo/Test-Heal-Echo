// src/components/weekly-habit/PSQITest.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import styles from "./PSQITest.module.css";
import { getUserName } from "@/auth/user";
import { ensureValidToken } from "@/auth/tokenManager";
import * as storage from "@/lib/storage";

/* ──────────────────────────────────────────────
   수면 기록 + Habit Tracker 관련
   ────────────────────────────────────────────── */

const TRACKER_STARTED_KEY = "weekly_habit_tracker_started";
const TRACKER_START_DATE_KEY = "weekly_habit_start_date";
const HABIT_ITEMS_KEY = "weekly_habit_custom_items";
const SLEEP_LOG_KEY = "weekly_habit_sleep_log"; // sleep_log_{YYYY-MM-DD}
const PSQI_POPUP_SHOWN_KEY = "weekly_habit_psqi_popup_shown";
/** 마이페이지 캘린더용: 해당 날짜에 실천 기록을 AWS에 저장 */
async function markPracticeDate(dateKey: string) {
  try {
    const tokens = await ensureValidToken();
    const token = tokens?.idToken ?? null;
    const res = await fetch("/api/user/practice-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type: "habit", date: dateKey }),
    });
    if (!res.ok) console.error("실천 기록 API 저장 실패:", res.status);
  } catch (err) {
    console.error("실천 기록 API 저장 실패:", err);
  }
}

type SleepLog = {
  sleepTime: string;   // HH:MM (어제 취침 시간)
  wakeTime: string;    // HH:MM (오늘 기상 시간)
  wakeCount: number;   // 깬 횟수
  hadDream: boolean | null; // 꿈 여부
  locked: boolean;     // 입력 완료 후 고정
  hadNap: boolean;     // 낮잠 여부
  napStart: string;    // HH:MM (낮잠 시작)
  napEnd: string;      // HH:MM (낮잠 종료)
  sleepMood: string;   // 어젯밤 수면 한마디 (감정 태그)
  sleepNote: string;   // 수면에 영향을 준 한 가지 (5주차~)
};

/* ── 스토리지 레이어 헬퍼 (오프라인 캐시 + 즉시 반영용 유지) ── */

function isTrackerStarted(): boolean {
  if (typeof window === "undefined") return false;
  storage.migrateKey(TRACKER_STARTED_KEY);
  return storage.get(TRACKER_STARTED_KEY) === "true";
}

function setTrackerStartedLocal(startDate?: string) {
  storage.set(TRACKER_STARTED_KEY, "true");
  storage.migrateKey(TRACKER_START_DATE_KEY);
  if (!storage.get(TRACKER_START_DATE_KEY)) {
    storage.set(TRACKER_START_DATE_KEY, startDate || getTodayKey());
  }
}

function getTrackerStartDate(): string {
  if (typeof window === "undefined") return getTodayKey();
  storage.migrateKey(TRACKER_START_DATE_KEY);
  return storage.get(TRACKER_START_DATE_KEY) || getTodayKey();
}

function getSavedHabitItems(): string[] {
  if (typeof window === "undefined") return ["핸드폰 멀리두고 자기"];
  storage.migrateKey(HABIT_ITEMS_KEY);
  const saved = storage.get(HABIT_ITEMS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch {}
  }
  return ["핸드폰 멀리두고 자기"];
}

function saveHabitItemsLocal(items: string[]) {
  storage.set(HABIT_ITEMS_KEY, JSON.stringify(items));
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodayKey(): string {
  return getDateKey(new Date());
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return `${y}.${m}.${d} (${days[date.getDay()]})`;
}

function shiftDate(dateKey: string, offset: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  return getDateKey(date);
}

const EMPTY_LOG: SleepLog & { checkedHabits: string[] } = {
  sleepTime: "", wakeTime: "", wakeCount: -1, hadDream: null, locked: false,
  hadNap: false, napStart: "", napEnd: "",
  sleepMood: "", sleepNote: "",
  checkedHabits: [],
};

const SLEEP_MOOD_OPTIONS = [
  { value: "goodMorning", emoji: "😊", label: "개운하게 일어났다" },
  { value: "okayish", emoji: "🙂", label: "생각보다 괜찮았다" },
  { value: "sleepy", emoji: "😪", label: "좀 더 자고 싶었다" },
  { value: "neutral", emoji: "😶", label: "잘 모르겠다" },
];

const SLEEP_MOOD_MESSAGES: Record<string, (name: string) => string> = {
  goodMorning: (name) =>
    `${name}님, 개운한 아침이에요.\n어젯밤 당신의 선택이 오늘 아침을 만들었어요.\n이 감각, 오늘도 이어가 볼까요?`,
  okayish: (name) =>
    `${name}님, 생각보다 괜찮은 아침이군요.\n'생각보다'라는 말 속에 좋은 변화가 숨어 있어요.\n몸이 조금씩 최고의 리듬을 찾아가고 있는 신호예요.`,
  sleepy: (name) =>
    `${name}님, 좀 더 자고 싶은 아침이군요.\n그건 몸이 보내는 솔직한 신호예요.\n오늘 밤, 몸이 원하는 만큼 쉴 수 있도록 힐에코와 함께 준비해요.`,
  neutral: (name) =>
    `${name}님, 아직 잘 모르겠는 아침이군요.\n괜찮아요, 모르겠다는 것도 오늘의 솔직한 기록이에요.\n기록이 쌓이면 나만의 수면 패턴이 보이기 시작해요.`,
};

function getSleepLogByDate(dateKey: string): SleepLog & { checkedHabits: string[] } {
  if (typeof window === "undefined") return { ...EMPTY_LOG };
  const saved = storage.get(`${SLEEP_LOG_KEY}_${dateKey}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { ...EMPTY_LOG, ...parsed };
    } catch {}
  }
  return { ...EMPTY_LOG };
}

function saveSleepLogByDateLocal(dateKey: string, log: SleepLog & { checkedHabits: string[] }) {
  storage.set(`${SLEEP_LOG_KEY}_${dateKey}`, JSON.stringify(log));
}

/* ── AWS API 헬퍼 ── */

async function saveSleepLogToAPI(dateKey: string, log: SleepLog & { checkedHabits: string[] }) {
  try {
    const tokens = await ensureValidToken();
    const token = tokens?.idToken ?? null;
    const res = await fetch("/api/user/sleep-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        date: dateKey,
        sleepTime: log.sleepTime,
        wakeTime: log.wakeTime,
        wakeCount: log.wakeCount,
        hadDream: log.hadDream,
        locked: log.locked,
        hadNap: log.hadNap,
        napStart: log.napStart,
        napEnd: log.napEnd,
        sleepMood: log.sleepMood,
        sleepNote: log.sleepNote,
        checkedHabits: log.checkedHabits,
      }),
    });
    if (!res.ok) console.error("수면 기록 API 저장 실패:", res.status);
  } catch (err) {
    console.error("수면 기록 API 저장 실패:", err);
  }
}

async function loadSleepLogFromAPI(dateKey: string): Promise<(SleepLog & { checkedHabits: string[] }) | null> {
  try {
    const tokens = await ensureValidToken();
    const token = tokens?.idToken ?? null;
    const res = await fetch(`/api/user/sleep-log?startDate=${dateKey}&endDate=${dateKey}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items = json.items || [];
    if (items.length > 0) {
      const item = items[0];
      return {
        sleepTime: item.sleepTime ?? "",
        wakeTime: item.wakeTime ?? "",
        wakeCount: item.wakeCount ?? 0,
        hadDream: item.hadDream ?? null,
        locked: item.locked ?? false,
        hadNap: item.hadNap ?? false,
        napStart: item.napStart ?? "",
        napEnd: item.napEnd ?? "",
        sleepMood: item.sleepMood ?? "",
        sleepNote: item.sleepNote ?? "",
        checkedHabits: item.checkedHabits ?? [],
      };
    }
  } catch (err) {
    console.error("수면 기록 API 조회 실패:", err);
  }
  return null;
}

async function saveConfigToAPI(config: { habitItems?: string[]; startDate?: string }) {
  try {
    const tokens = await ensureValidToken();
    const token = tokens?.idToken ?? null;
    const res = await fetch("/api/user/sleep-log/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) console.error("습관 설정 API 저장 실패:", res.status);
  } catch (err) {
    console.error("습관 설정 API 저장 실패:", err);
  }
}

async function loadConfigFromAPI(): Promise<{ habitItems?: string[]; startDate?: string } | null> {
  try {
    const tokens = await ensureValidToken();
    const token = tokens?.idToken ?? null;
    const res = await fetch("/api/user/sleep-log/config", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.item || null;
  } catch (err) {
    console.error("습관 설정 API 조회 실패:", err);
  }
  return null;
}

/** 연속 실천 스트릭 계산: 오늘부터 과거로 거슬러 올라가며 습관 1개 이상 체크한 연속 일수 */
function calculateStreak(): number {
  if (typeof window === "undefined") return 0;
  const startDate = getTrackerStartDate();
  let streak = 0;
  let currentDate = getTodayKey();

  // 오늘 기록이 아직 없으면 어제부터 시작
  const todayLog = getSleepLogByDate(currentDate);
  if (todayLog.checkedHabits.length === 0) {
    currentDate = shiftDate(currentDate, -1);
  }

  while (currentDate >= startDate) {
    const log = getSleepLogByDate(currentDate);
    if (log.checkedHabits.length > 0) {
      streak++;
      currentDate = shiftDate(currentDate, -1);
    } else {
      break;
    }
  }
  return streak;
}

/* ──────────────────────────────────────────────
   PSQI 채점 로직 (7개 구성 요소, 0~21점)
   ────────────────────────────────────────────── */

type PSQIAnswers = {
  q1: string;  // 잠자리에 드는 시간 (HH:MM)
  q2: string;  // 잠들기까지 걸린 시간 (분)
  q3: string;  // 아침 기상 시간 (HH:MM)
  q4: string;  // 실제 수면 시간 (시간)
  q5a: number; // 30분 이내 잠 못듦 (0-3)
  q5b: number; // 한밤중/이른 아침 깨어남
  q5c: number; // 화장실
  q5d: number; // 편안하게 숨 못쉼
  q5e: number; // 기침/코골이
  q5f: number; // 너무 춥다
  q5g: number; // 너무 덥다
  q5h: number; // 나쁜 꿈
  q5i: number; // 통증
  q5j: number; // 기타
  q6: number;  // 수면 보조 약 복용
  q7: number;  // 깨어 있기 어려움
  q8: number;  // 열성 유지 어려움
  q9: number;  // 전반적 수면 품질
};

const DEFAULT_ANSWERS: PSQIAnswers = {
  q1: "", q2: "", q3: "", q4: "",
  q5a: -1, q5b: -1, q5c: -1, q5d: -1, q5e: -1,
  q5f: -1, q5g: -1, q5h: -1, q5i: -1, q5j: -1,
  q6: -1, q7: -1, q8: -1, q9: -1,
};

function calculatePSQI(a: PSQIAnswers) {
  // 구성 요소 1: 주관적 수면 품질 (Q9)
  const c1 = a.q9;

  // 구성 요소 2: 수면 잠복기 (Q2 + Q5a)
  const q2Min = parseFloat(a.q2) || 0;
  let q2Sub = 0;
  if (q2Min <= 15) q2Sub = 0;
  else if (q2Min <= 30) q2Sub = 1;
  else if (q2Min <= 60) q2Sub = 2;
  else q2Sub = 3;

  const q5aSub = a.q5a;
  const c2Sum = q2Sub + q5aSub;
  let c2 = 0;
  if (c2Sum === 0) c2 = 0;
  else if (c2Sum <= 2) c2 = 1;
  else if (c2Sum <= 4) c2 = 2;
  else c2 = 3;

  // 구성 요소 3: 수면 시간 (Q4)
  const sleepHours = parseFloat(a.q4) || 0;
  let c3 = 0;
  if (sleepHours > 7) c3 = 0;
  else if (sleepHours >= 6) c3 = 1;
  else if (sleepHours >= 5) c3 = 2;
  else c3 = 3;

  // 구성 요소 4: 수면 효율성 (Q1, Q3, Q4)
  const bedTime = parseTimeToMinutes(a.q1);
  const wakeTime = parseTimeToMinutes(a.q3);
  let timeInBed = 0;
  if (bedTime !== null && wakeTime !== null) {
    timeInBed = wakeTime - bedTime;
    if (timeInBed <= 0) timeInBed += 24 * 60; // 자정 넘김 처리
  }
  const efficiency = timeInBed > 0 ? (sleepHours * 60 / timeInBed) * 100 : 0;
  let c4 = 0;
  if (efficiency > 85) c4 = 0;
  else if (efficiency >= 75) c4 = 1;
  else if (efficiency >= 65) c4 = 2;
  else c4 = 3;

  // 구성 요소 5: 수면 방해 (Q5b ~ Q5j)
  const c5Sum = a.q5b + a.q5c + a.q5d + a.q5e + a.q5f + a.q5g + a.q5h + a.q5i + a.q5j;
  let c5 = 0;
  if (c5Sum === 0) c5 = 0;
  else if (c5Sum <= 9) c5 = 1;
  else if (c5Sum <= 18) c5 = 2;
  else c5 = 3;

  // 구성 요소 6: 수면제 사용 (Q6)
  const c6 = a.q6;

  // 구성 요소 7: 주간 기능 장애 (Q7 + Q8)
  const c7Sum = a.q7 + a.q8;
  let c7 = 0;
  if (c7Sum === 0) c7 = 0;
  else if (c7Sum <= 2) c7 = 1;
  else if (c7Sum <= 4) c7 = 2;
  else c7 = 3;

  const total = c1 + c2 + c3 + c4 + c5 + c6 + c7;

  return {
    components: { c1, c2, c3, c4, c5, c6, c7 },
    total,
    efficiency: Math.round(efficiency),
  };
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function getSleepQualityLabel(total: number): { label: string; color: string; grade: string } {
  if (total <= 2) return { label: "수면 품질 최상", color: "#059669", grade: "S" };
  if (total <= 5) return { label: "수면 품질 양호", color: "#10b981", grade: "A" };
  if (total <= 7) return { label: "수면 품질 보통", color: "#f59e0b", grade: "B" };
  if (total <= 10) return { label: "수면 품질 미흡", color: "#f97316", grade: "C" };
  if (total <= 15) return { label: "수면 품질 불량", color: "#ef4444", grade: "D" };
  return { label: "수면 품질 매우 불량", color: "#dc2626", grade: "F" };
}

/** PSQI 원점수(0~21)를 10점 만점 비선형 역환산 (높을수록 좋음, 지수 1.6 하향 압축) */
function toScore10(total: number): number {
  return Math.round(Math.pow(1 - total / 21, 1.6) * 100) / 10;
}

/** 이상적 수면까지 남은 개선 점수 */
function getGapScore(total: number): number {
  return Math.round((10 - toScore10(total)) * 10) / 10;
}

/* ──────────────────────────────────────────────
   시간 선택 (시/분 분리, 분은 10분 단위)
   ────────────────────────────────────────────── */

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const NAP_HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 6); // 오전 6시 ~ 오후 9시
const MINUTE_OPTIONS = [0, 10, 20, 30, 40, 50];

function TimeSelect({
  value,
  onChange,
  label,
  hourOptions,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hourOptions?: number[];
}) {
  const hours = hourOptions || HOUR_OPTIONS;
  const [hour, minute] = value
    ? value.split(":").map((v) => parseInt(v, 10))
    : [-1, -1];

  function handleChange(newHour: number, newMinute: number) {
    if (newHour < 0 || newMinute < 0) {
      onChange("");
      return;
    }
    const hh = String(newHour).padStart(2, "0");
    const mm = String(newMinute).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  }

  return (
    <div className={styles.timeSelectRow}>
      <select
        className={styles.timeSelect}
        value={hour >= 0 ? hour : ""}
        aria-label={`${label} 시`}
        onChange={(e) => {
          const h = parseInt(e.target.value, 10);
          handleChange(h, minute >= 0 ? minute : 0);
        }}
      >
        <option value="" disabled>
          시
        </option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h < 12
              ? `오전 ${h === 0 ? 12 : h}시`
              : `오후 ${h === 12 ? 12 : h - 12}시`}
          </option>
        ))}
      </select>
      <span className={styles.timeSeparator}>:</span>
      <select
        className={styles.timeSelect}
        value={minute >= 0 ? minute : ""}
        aria-label={`${label} 분`}
        onChange={(e) => {
          const m = parseInt(e.target.value, 10);
          handleChange(hour >= 0 ? hour : 0, m);
        }}
      >
        <option value="" disabled>
          분
        </option>
        {MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}분
          </option>
        ))}
      </select>
    </div>
  );
}

/* ──────────────────────────────────────────────
   컴포넌트
   ────────────────────────────────────────────── */

type PSQIResult = {
  total: number;
  components: Record<string, number>;
  efficiency: number;
};

type Props = {
  onSubmit?: (result: {
    answers: PSQIAnswers;
    total: number;
    components: Record<string, number>;
    efficiency: number;
  }) => void;
  /** 이미 완료된 PSQI 결과가 있으면 결과 화면을 바로 표시 */
  initialResult?: PSQIResult | null;
  /** 현재 주차 (5주차부터 자유 기록란 활성화) */
  weekNumber?: number;
  /** 관리자가 등록한 누적 수면 습관 목록 (삭제 불가) */
  adminHabits?: string[];
  /** 독립 페이지 모드: step 0+1만 렌더링, step 2 대신 외부 네비게이션 */
  standalone?: boolean;
  /** standalone 모드에서 CTA 클릭 시 호출 (결과 화면 → 위클리 해빗으로 이동) */
  onNavigateToHabit?: () => void;
  /** standalone 모드에서 "나중에 하기" 클릭 시 호출 */
  onSkip?: () => void;
  /** embedded 모드에서 miniScoreCard 클릭 시 호출 (결과 페이지로 이동) */
  onViewResult?: () => void;
  /** standalone 모드 결과 화면 CTA 텍스트 (기본: "최고의 수면 습관 만들기") */
  ctaText?: string;
  /** standalone 모드 "나중에 하기" 텍스트 (기본: "나중에 하기") */
  skipText?: string;
};

const FREQ_OPTIONS = [
  { value: 0, label: "지난 달에는 없었음" },
  { value: 1, label: "일주일에 한 번 이하" },
  { value: 2, label: "일주일에 한두 번" },
  { value: 3, label: "일주일에 3회 이상" },
];

export default function PSQITest({ onSubmit, initialResult, weekNumber = 1, adminHabits = [], standalone = false, onNavigateToHabit, onSkip, onViewResult, ctaText = "최고의 수면 습관 만들기", skipText = "나중에 하기" }: Props) {
  const [answers, setAnswers] = useState<PSQIAnswers>({ ...DEFAULT_ANSWERS });
  // step: 0=설문, 1=결과, 2=수면기록+습관트래커
  const [step, setStep] = useState(() => {
    if (standalone) {
      // 독립 페이지: 결과가 있으면 결과 화면, 없으면 설문
      if (initialResult) return 1;
      return 0;
    }
    if (initialResult && isTrackerStarted()) return 2;
    if (initialResult) return 1;
    return 0;
  });
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<PSQIResult | null>(initialResult ?? null);

  // ── Step 2: 수면 기록 + Habit Tracker state ──
  const [habitItems, setHabitItems] = useState<string[]>(getSavedHabitItems);
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const [sleepLog, setSleepLog] = useState(() => getSleepLogByDate(getTodayKey()));
  const [newHabitText, setNewHabitText] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [activeTab, setActiveTab] = useState<"sleep" | "food" | "mind">("sleep");
  // 시간 기반 잠금: 오늘 = 자유 편집, 어제 이전 = 읽기 전용 (수정 모드로 해제 가능)
  const [isEditMode, setIsEditMode] = useState(false);
  const isPastDate = selectedDate < getTodayKey();
  const isDateLocked = isPastDate && !isEditMode;
  const [streak, setStreak] = useState(() => calculateStreak());
  const [userName, setUserName] = useState("");
  const [showPsqiPopup, setShowPsqiPopup] = useState(false);

  // API 초기 로드 완료 여부
  const configLoadedRef = useRef(false);

  // ── 마운트 시 API에서 설정 로드 (습관 목록 + 트래커 시작일) ──
  useEffect(() => {
    if (configLoadedRef.current) return;
    configLoadedRef.current = true;

    async function loadConfig() {
      const config = await loadConfigFromAPI();
      if (config) {
        // API 데이터로 storage 레이어 동기화
        if (config.habitItems && config.habitItems.length > 0) {
          setHabitItems(config.habitItems);
          saveHabitItemsLocal(config.habitItems);
        }
        if (config.startDate) {
          setTrackerStartedLocal(config.startDate);
          // step 재판단: standalone 모드에서는 step 2 사용 안 함
          if (initialResult && !standalone) {
            setStep(2);
          }
        }
      }
    }

    loadConfig();
  }, [initialResult]);

  // ── 날짜 변경 시 API에서 수면 기록 로드 ──
  useEffect(() => {
    if (step !== 2) return;

    async function loadLog() {
      const apiLog = await loadSleepLogFromAPI(selectedDate);
      if (apiLog) {
        // API 데이터로 storage 레이어 + state 동기화
        saveSleepLogByDateLocal(selectedDate, apiLog);
        setSleepLog(apiLog);
      }
    }

    loadLog();
  }, [selectedDate, step]);

  // 사용자 이름 가져오기 (mood 메시지에 사용)
  useEffect(() => {
    const name = getUserName();
    if (name) setUserName(name);
  }, []);

  // mood 락: 오늘 날짜에 sleepMood가 이미 선택되어 있으면 잠금
  const isMoodLocked = isEditMode ? false : (isDateLocked || !!sleepLog.sleepMood);

  const updateAnswer = useCallback(
    <K extends keyof PSQIAnswers>(key: K, value: PSQIAnswers[K]) => {
      setAnswers((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  function isComplete(): boolean {
    if (!answers.q1 || !answers.q2 || !answers.q3 || !answers.q4) return false;
    const radioKeys: (keyof PSQIAnswers)[] = [
      "q5a", "q5b", "q5c", "q5d", "q5e", "q5f", "q5g", "q5h", "q5i", "q5j",
      "q6", "q7", "q8", "q9",
    ];
    return radioKeys.every((k) => (answers[k] as number) >= 0);
  }

  async function handleSubmit() {
    if (!isComplete()) return;
    const result = calculatePSQI(answers);

    setSaving(true);
    try {
      if (onSubmit) {
        await onSubmit({
          answers,
          total: result.total,
          components: result.components,
          efficiency: result.efficiency,
        });
      }
    } catch (err) {
      console.error("PSQI 결과 저장 실패:", err);
    } finally {
      setSaving(false);
    }

    setSavedResult(result);
    setStep(1);

    // 첫 1회만 "다음 검사는 4주 후" 팝업 표시
    storage.migrateKey(PSQI_POPUP_SHOWN_KEY);
    if (!storage.get(PSQI_POPUP_SHOWN_KEY)) {
      storage.set(PSQI_POPUP_SHOWN_KEY, "true");
      setShowPsqiPopup(true);
    }
  }

  function handleReset() {
    setAnswers({ ...DEFAULT_ANSWERS });
    setStep(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── CTA 클릭 → step 2 전환 또는 외부 네비게이션 ──
  function handleCTAClick() {
    if (standalone && onNavigateToHabit) {
      // 독립 페이지: 위클리 해빗으로 이동
      onNavigateToHabit();
      return;
    }
    const startDate = getTodayKey();
    setTrackerStartedLocal(startDate);
    // AWS에도 저장
    saveConfigToAPI({ startDate, habitItems });
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── 날짜 이동 ──
  function goToDate(offset: number) {
    const newDate = shiftDate(selectedDate, offset);
    // 미래 날짜 방지
    if (newDate > getTodayKey()) return;
    // 무료 체험 시작일 이전 방지
    if (newDate < getTrackerStartDate()) return;
    setSelectedDate(newDate);
    setSleepLog(getSleepLogByDate(newDate));
    setIsEditMode(false); // 날짜 이동 시 수정 모드 해제
  }

  // ── 수면 기록 업데이트 (storage 즉시 + API 비동기) ──
  function updateSleepLog(partial: Partial<SleepLog & { checkedHabits: string[] }>) {
    setSleepLog((prev) => {
      const updated = { ...prev, ...partial };
      // storage 즉시 저장
      saveSleepLogByDateLocal(selectedDate, updated);
      return updated;
    });
    // API 비동기 저장 (side effect는 setState 밖에서 실행)
    const merged = { ...sleepLog, ...partial };
    saveSleepLogToAPI(selectedDate, merged);
    markPracticeDate(selectedDate);
  }

  // ── 수면 기록 입력 완료 가능 여부 ──
  function isSleepLogFilled(): boolean {
    return sleepLog.sleepTime !== "" && sleepLog.wakeTime !== "" && sleepLog.wakeCount >= 0;
  }

  function toggleHabitCheck(item: string) {
    const checked = sleepLog.checkedHabits.includes(item)
      ? sleepLog.checkedHabits.filter((h) => h !== item)
      : [...sleepLog.checkedHabits, item];
    const updated = { ...sleepLog, checkedHabits: checked };
    setSleepLog(updated);
    // storage 즉시 저장
    saveSleepLogByDateLocal(selectedDate, updated);
    // API 비동기 저장 (side effect는 setState 밖에서 실행)
    saveSleepLogToAPI(selectedDate, updated);
    markPracticeDate(selectedDate);
  }

  function addHabitItem() {
    const trimmed = newHabitText.trim();
    if (!trimmed || habitItems.includes(trimmed)) return;
    const updated = [...habitItems, trimmed];
    setHabitItems(updated);
    // storage 즉시 저장
    saveHabitItemsLocal(updated);
    // API 비동기 저장
    saveConfigToAPI({ habitItems: updated });
    setNewHabitText("");
    setShowAddInput(false);
  }

  function removeHabitItem(item: string) {
    const updated = habitItems.filter((h) => h !== item);
    setHabitItems(updated);
    // storage 즉시 저장
    saveHabitItemsLocal(updated);
    // API 비동기 저장
    saveConfigToAPI({ habitItems: updated });
    // 체크 기록에서도 제거
    if (sleepLog.checkedHabits.includes(item)) {
      toggleHabitCheck(item);
    }
  }

  // ── Step 2: 수면 기록 + Habit Tracker (standalone 모드에서는 사용 안 함) ──
  if (step === 2 && !standalone) {
    const result = savedResult ?? (initialResult || { total: 0, components: {}, efficiency: 0 });
    const quality = getSleepQualityLabel(result.total);

    return (
      <div className={styles.container}>
        {/* 상단: 수면 건강 점수 미니 카드 */}
        <button
          className={styles.miniScoreCard}
          onClick={() => {
            if (onViewResult) {
              onViewResult();
              return;
            }
            setStep(1); window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <div className={styles.miniScoreCircle} style={{ borderColor: quality.color }}>
            <span className={styles.miniScoreNum} style={{ color: quality.color }}>{toScore10(result.total)}<small style={{ fontSize: "0.55em", opacity: 0.7 }}>/10</small></span>
          </div>
          <div className={styles.miniScoreInfo}>
            <span className={styles.miniScoreLabel}>나의 수면 건강 점수</span>
            <div className={styles.miniScoreGradeRow}>
              <span className={styles.miniScoreGrade} style={{ background: quality.color }}>{quality.grade}</span>
              <span className={styles.miniScoreGap} style={{ color: quality.color }}>
                목표까지 {getGapScore(result.total)}점
              </span>
            </div>
          </div>
          <span className={styles.miniScoreArrow}>›</span>
        </button>

        {/* 카테고리 탭 */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === "sleep" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("sleep")}
          >수면 습관</button>
          <button
            className={`${styles.tab} ${activeTab === "food" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("food")}
          >식습관</button>
          <button
            className={`${styles.tab} ${activeTab === "mind" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("mind")}
          >마음 습관</button>
        </div>

        {/* 식습관 탭 — 준비 중 */}
        {activeTab === "food" && (
          <div className={styles.comingSoonCard}>
            <span className={styles.comingSoonIcon}>🥗</span>
            <p className={styles.comingSoonText}>5주차에 오픈됩니다.</p>
          </div>
        )}

        {/* 마음 습관 탭 — 준비 중 */}
        {activeTab === "mind" && (
          <div className={styles.comingSoonCard}>
            <span className={styles.comingSoonIcon}>🧘</span>
            <p className={styles.comingSoonText}>9주차에 오픈됩니다.</p>
          </div>
        )}

        {/* 수면 습관 탭 — 수면 기록 */}
        {activeTab === "sleep" && <>
        <div className={styles.trackerCard}>
          <div className={styles.trackerHeader}>
            <h3 className={styles.trackerTitle}>수면 기록</h3>
            {isPastDate && (
              isEditMode ? (
                <button
                  className={styles.editModeBtn}
                  onClick={() => setIsEditMode(false)}
                  title="수정 완료"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3 6 11.6 2.7 8.3" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span>완료</span>
                </button>
              ) : (
                <button
                  className={styles.editModeBtn}
                  onClick={() => setIsEditMode(true)}
                  title="수정하기"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5a2.121 2.121 0 113 3L5 14l-4 1 1-4 9.5-9.5z" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span>수정</span>
                </button>
              )
            )}
          </div>

          {/* 날짜 네비게이션 */}
          <div className={styles.dateNav}>
            <button
              className={`${styles.dateNavBtn} ${selectedDate <= getTrackerStartDate() ? styles.dateNavBtnDisabled : ""}`}
              onClick={() => goToDate(-1)}
              disabled={selectedDate <= getTrackerStartDate()}
            >‹</button>
            <span className={styles.dateNavLabel}>
              {formatDateLabel(selectedDate)}
            </span>
            <button
              className={`${styles.dateNavBtn} ${selectedDate >= getTodayKey() ? styles.dateNavBtnDisabled : ""}`}
              onClick={() => goToDate(1)}
              disabled={selectedDate >= getTodayKey()}
            >›</button>
          </div>

          <div className={styles.sleepFields}>
            <div className={styles.sleepField}>
              <label className={styles.sleepFieldLabel}>
                <span className={styles.fieldIcon}>🌙</span>어제 취침 시간
              </label>
              {isDateLocked ? (
                <span className={styles.lockedValue}>{sleepLog.sleepTime || "—"}</span>
              ) : (
                <TimeSelect
                  value={sleepLog.sleepTime}
                  onChange={(v) => updateSleepLog({ sleepTime: v })}
                  label="어제 취침 시간"
                />
              )}
            </div>

            <div className={styles.sleepField}>
              <label className={styles.sleepFieldLabel}>
                <span className={styles.fieldIcon}>☀️</span>오늘 기상 시간
              </label>
              {isDateLocked ? (
                <span className={styles.lockedValue}>{sleepLog.wakeTime || "—"}</span>
              ) : (
                <TimeSelect
                  value={sleepLog.wakeTime}
                  onChange={(v) => updateSleepLog({ wakeTime: v })}
                  label="오늘 기상 시간"
                />
              )}
            </div>

            <div className={styles.sleepField}>
              <label className={styles.sleepFieldLabel}>
                <span className={styles.fieldIcon}>👁️</span>잠에서 깬 횟수
              </label>
              {isDateLocked ? (
                <span className={styles.lockedValue}>{sleepLog.wakeCount >= 0 ? `${sleepLog.wakeCount}회` : "—"}</span>
              ) : (
                <div className={styles.wakeCountRow}>
                  <button
                    className={styles.wakeCountBtn}
                    onClick={() => updateSleepLog({ wakeCount: Math.max(0, sleepLog.wakeCount - 1) })}
                    disabled={sleepLog.wakeCount < 0}
                  >−</button>
                  <span className={styles.wakeCountNum}>{sleepLog.wakeCount >= 0 ? `${sleepLog.wakeCount}회` : "—"}</span>
                  <button
                    className={styles.wakeCountBtn}
                    onClick={() => updateSleepLog({ wakeCount: sleepLog.wakeCount < 0 ? 0 : sleepLog.wakeCount + 1 })}
                  >+</button>
                </div>
              )}
            </div>
            {/* 낮잠 기록 */}
            <div className={styles.sleepField}>
              <div className={styles.napToggleRow}>
                <label className={styles.sleepFieldLabel} style={{ marginBottom: 0 }}>
                  <span className={styles.fieldIcon}>💤</span>어제의 낮잠
                </label>
                {isDateLocked ? (
                  <span className={styles.lockedValue}>{sleepLog.hadNap ? "있음" : "없음"}</span>
                ) : (
                  <button
                    className={`${styles.napToggle} ${sleepLog.hadNap ? styles.napToggleOn : ""}`}
                    onClick={() => updateSleepLog({ hadNap: !sleepLog.hadNap, ...(!sleepLog.hadNap ? {} : { napStart: "", napEnd: "" }) })}
                    aria-label="낮잠 여부 토글"
                  >
                    <span className={styles.napToggleThumb} />
                  </button>
                )}
              </div>

              {sleepLog.hadNap && (
                <div className={styles.napTimeFields}>
                  <div className={styles.napTimeField}>
                    <label className={styles.napTimeLabel}>시작</label>
                    {isDateLocked ? (
                      <span className={styles.lockedValue}>{sleepLog.napStart || "—"}</span>
                    ) : (
                      <TimeSelect
                        value={sleepLog.napStart}
                        onChange={(v) => updateSleepLog({ napStart: v })}
                        label="낮잠 시작"
                        hourOptions={NAP_HOUR_OPTIONS}
                      />
                    )}
                  </div>
                  <div className={styles.napTimeField}>
                    <label className={styles.napTimeLabel}>종료</label>
                    {isDateLocked ? (
                      <span className={styles.lockedValue}>{sleepLog.napEnd || "—"}</span>
                    ) : (
                      <TimeSelect
                        value={sleepLog.napEnd}
                        onChange={(v) => updateSleepLog({ napEnd: v })}
                        label="낮잠 종료"
                        hourOptions={NAP_HOUR_OPTIONS}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 오늘 아침 나는 — 원탭 감정 태그 */}
          <div className={styles.sleepMoodSection}>
            <label className={styles.sleepMoodLabel}>오늘 아침 나는</label>
            <div className={styles.sleepMoodTags}>
              {SLEEP_MOOD_OPTIONS.map((opt) => {
                const isActive = sleepLog.sleepMood === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={`${styles.sleepMoodTag} ${isActive ? styles.sleepMoodTagActive : ""} ${isMoodLocked ? styles.sleepMoodTagLocked : ""}`}
                    onClick={() => {
                      if (isMoodLocked) return;
                      updateSleepLog({ sleepMood: isActive ? "" : opt.value });
                    }}
                    disabled={isMoodLocked}
                  >
                    <span className={styles.sleepMoodEmoji}>{opt.emoji}</span>
                    <span className={styles.sleepMoodText}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {/* 감정 선택 후 CBT 기반 메시지 */}
            {sleepLog.sleepMood && SLEEP_MOOD_MESSAGES[sleepLog.sleepMood] && (
              <div className={styles.sleepMoodMessage}>
                {SLEEP_MOOD_MESSAGES[sleepLog.sleepMood](userName || "회원").split("\n").map((line, i) => (
                  <p key={i} className={i === 0 ? styles.sleepMoodMessageFirst : undefined}>{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* 5주차부터: 수면에 영향을 준 한 가지 */}
          {weekNumber >= 5 && (
            <div className={styles.sleepNoteSection}>
              <label className={styles.sleepNoteLabel}>오늘 수면에 영향을 준 한 가지가 있다면?</label>
              {isDateLocked ? (
                <p className={styles.sleepNoteLockedText}>{sleepLog.sleepNote || "—"}</p>
              ) : (
                <textarea
                  className={styles.sleepNoteInput}
                  value={sleepLog.sleepNote}
                  onChange={(e) => updateSleepLog({ sleepNote: e.target.value })}
                  placeholder="예: 늦게 먹은 야식, 카페인, 운동 후 개운함..."
                  maxLength={200}
                  rows={2}
                />
              )}
            </div>
          )}
        </div>

        {/* 수면 습관 Habit Tracker — 회고형 */}
        <div className={styles.trackerCard}>
          <div className={styles.trackerHeader}>
            <h3 className={styles.trackerTitle}>어제 이 습관들을 실천했나요?</h3>
            {isDateLocked ? (
              <span className={styles.lockedBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 7V5a4 4 0 118 0v2M3 7h10a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            ) : !showAddInput && !isPastDate && (
              <button className={styles.addHabitBtn} onClick={() => setShowAddInput(true)} title="새 항목 추가">
                +
              </button>
            )}
          </div>

          {/* 스트릭 카운터 */}
          {streak > 0 && (
            <div className={styles.streakBadge}>
              <span className={styles.streakFire}>🔥</span>
              <span className={styles.streakText}>{streak}일 연속 실천 중</span>
            </div>
          )}

          <div className={styles.habitList}>
            {/* 관리자 필수 습관 (상단, 삭제 불가) */}
            {adminHabits.map((item) => {
              const checked = sleepLog.checkedHabits.includes(item);
              return (
                <label key={`admin-${item}`} className={`${styles.habitItem} ${styles.habitItemAdmin} ${isDateLocked ? styles.habitItemLocked : ""}`}>
                  <input
                    type="checkbox"
                    className={styles.habitCheckbox}
                    checked={checked}
                    onChange={() => { if (!isDateLocked) toggleHabitCheck(item); }}
                    disabled={isDateLocked}
                  />
                  <span className={`${styles.habitCheckMark} ${checked ? styles.habitChecked : ""}`}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className={`${styles.habitText} ${checked ? styles.habitTextChecked : ""}`}>
                    {item}
                  </span>
                </label>
              );
            })}
            {/* 사용자 커스텀 습관 (하단, 삭제 가능) */}
            {habitItems.filter((item) => !adminHabits.includes(item)).map((item) => {
              const checked = sleepLog.checkedHabits.includes(item);
              return (
                <label key={`user-${item}`} className={`${styles.habitItem} ${isDateLocked ? styles.habitItemLocked : ""}`}>
                  <input
                    type="checkbox"
                    className={styles.habitCheckbox}
                    checked={checked}
                    onChange={() => { if (!isDateLocked) toggleHabitCheck(item); }}
                    disabled={isDateLocked}
                  />
                  <span className={`${styles.habitCheckMark} ${checked ? styles.habitChecked : ""}`}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className={`${styles.habitText} ${checked ? styles.habitTextChecked : ""}`}>
                    {item}
                  </span>
                  {!isDateLocked && (
                    <button
                      className={styles.habitRemoveBtn}
                      onClick={(e) => { e.preventDefault(); removeHabitItem(item); }}
                    >×</button>
                  )}
                </label>
              );
            })}
          </div>

          {/* 새 항목 추가 입력 — 오늘만 */}
          {!isDateLocked && showAddInput && (
            <div className={styles.addHabitRow}>
              <input
                type="text"
                className={styles.addHabitInput}
                value={newHabitText}
                onChange={(e) => setNewHabitText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addHabitItem(); }}
                placeholder="새 수면 습관을 입력하세요"
                autoFocus
              />
              <button className={styles.addHabitConfirm} onClick={addHabitItem}>추가</button>
              <button className={styles.addHabitCancel} onClick={() => { setShowAddInput(false); setNewHabitText(""); }}>취소</button>
            </div>
          )}
        </div>

        </>}
      </div>
    );
  }

  // ── 결과 화면 ──
  if (step === 1) {
    const result = savedResult ?? calculatePSQI(answers);
    const quality = getSleepQualityLabel(result.total);

    // 결손 프레이밍 + 등급별 동기부여 문구
    const gap = getGapScore(result.total);
    const motivationMsg = result.total <= 2
      ? `최상의 수면을 유지하고 있어요!\n다음 세션에서 이 좋은 컨디션을 더 단단하게 만들어 볼까요?`
      : result.total <= 5
      ? `S등급까지 ${gap}점 남았어요.\n다음 세션에서 이 좋은 습관을 한 단계 더 끌어올려 볼까요?`
      : result.total <= 7
      ? `최상의 수면까지 ${gap}점 개선 여정이 남아있어요.\n다음 세션에서 배우는 실천법이 수면의 질을 한 단계 끌어올려 줄 수 있어요.`
      : result.total <= 10
      ? `최상의 수면까지 ${gap}점 개선이 필요해요.\n다음 세션에서 배우는 수면 전략이 분명 도움이 됩니다.`
      : result.total <= 15
      ? `최상의 수면까지 ${gap}점 개선이 필요해요.\n지금 시작하면 충분히 좋아질 수 있습니다.`
      : `최상의 수면까지 ${gap}점 개선이 필요해요.\n다음 세션은 이런 어려움을 함께 풀어가기 위해 준비되어 있어요.`;

    // 등급별 라벨
    const qualityShortLabel = result.total <= 2
      ? "최상의 수면 습관"
      : result.total <= 5
      ? "양호하지만, 더 좋아질 수 있어요"
      : result.total <= 7
      ? "개선하면 확 달라질 수 있어요"
      : result.total <= 10
      ? "개선이 필요한 수면 습관"
      : result.total <= 15
      ? "수면 관리가 시급해요"
      : "적극적인 수면 관리가 필요해요";

    return (
      <div className={styles.container}>
        {/* ── PSQI 완료 팝업 (첫 1회) ── */}
        {showPsqiPopup && (
          <div className={styles.psqiPopupOverlay} onClick={() => setShowPsqiPopup(false)}>
            <div className={styles.psqiPopup} onClick={(e) => e.stopPropagation()}>
              <div className={styles.psqiPopupIcon}>✨</div>
              <h3 className={styles.psqiPopupTitle}>수면 건강 검사 완료!</h3>
              <p className={styles.psqiPopupDesc}>
                &lsquo;수면의 질&rsquo; 다음 검사는<br />
                <strong>4주 후</strong>입니다.
              </p>
              <p className={styles.psqiPopupSub}>
                그 사이, 매일의 수면 기록과 습관이<br />
                당신의 수면을 바꿔갈 거예요.
              </p>
              <button className={styles.psqiPopupBtn} onClick={() => setShowPsqiPopup(false)}>
                확인
              </button>
            </div>
          </div>
        )}

        {/* ── 1단계: 점수 + 동기부여 ── */}
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>나의 수면 건강 점수</h2>

          <div className={styles.percentCircle} style={{ borderColor: quality.color }}>
            <span className={styles.percentNumber} style={{ color: quality.color }}>
              {toScore10(result.total)}
            </span>
            <span className={styles.percentUnit} style={{ color: quality.color }}>/10</span>
          </div>

          <div className={styles.gradeRow}>
            <span className={styles.gradeBadge} style={{ background: quality.color }}>
              {quality.grade}
            </span>
            <span className={styles.qualityBadge} style={{ background: quality.color }}>
              {qualityShortLabel}
            </span>
          </div>

          <p className={styles.motivationText}>
            {motivationMsg.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>

          {/* 상세 점수 토글 */}
          <details className={styles.detailToggle}>
            <summary className={styles.detailSummary}>상세 점수 보기</summary>
            <div className={styles.detailContent}>
              <div className={styles.rawScoreRow}>
                <span className={styles.rawScoreLabel}>PSQI 총점</span>
                <span className={styles.rawScoreValue}>{toScore10(result.total)} <span className={styles.rawScoreMax}>/ 10</span></span>
              </div>
              <div className={styles.componentGrid}>
                {[
                  { key: "c1", name: "주관적 수면 품질" },
                  { key: "c2", name: "수면 잠복기" },
                  { key: "c3", name: "수면 시간" },
                  { key: "c4", name: "수면 효율성" },
                  { key: "c5", name: "수면 방해" },
                  { key: "c6", name: "수면제 사용" },
                  { key: "c7", name: "주간 기능 장애" },
                ].map((comp) => (
                  <div key={comp.key} className={styles.componentItem}>
                    <span className={styles.componentName}>{comp.name}</span>
                    <span className={styles.componentScore}>
                      {result.components[comp.key as keyof typeof result.components]}
                      <span className={styles.componentMax}>/3</span>
                    </span>
                  </div>
                ))}
              </div>
              {result.efficiency > 0 && (
                <div className={styles.efficiencyRow}>
                  <span className={styles.efficiencyLabel}>수면 효율</span>
                  <span className={styles.efficiencyValue}>{result.efficiency}%</span>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* ── 2단계: 자율신경 증상 공감 섹션 ── */}
        <div className={styles.symptomSection}>
          <p className={styles.symptomIntro}>
            자율신경이 불균형할 때,<br />
            우리 몸은 이런 신호를 보냅니다.
          </p>

          <div className={styles.symptomGrid}>
            {[
              { icon: "😴", text: "만성 피로" },
              { icon: "🫠", text: "소화 불량" },
              { icon: "💓", text: "두근거림" },
              { icon: "😶‍🌫️", text: "브레인 포그" },
              { icon: "😰", text: "감정 기복" },
              { icon: "🥶", text: "체온 이상" },
            ].map((item, i) => (
              <div key={i} className={styles.symptomChip}>
                <span className={styles.symptomIcon}>{item.icon}</span>
                <span className={styles.symptomText}>{item.text}</span>
              </div>
            ))}
          </div>

          <p className={styles.symptomConnect}>
            따로따로인 것 같지만,<br />
            이 증상들은 <strong>하나로 연결</strong>되어 있습니다.
          </p>

          <div className={styles.symptomKeyMsg}>
            그 중심에 <strong>수면</strong>이 있습니다.
          </div>
        </div>

        {/* ── 3단계: 선순환 다이어그램 + CTA ── */}
        <div className={styles.cycleSection}>
          {/* 악순환 */}
          <div className={styles.cycleBox + " " + styles.cycleBad}>
            <span className={styles.cycleLabel}>지금의 악순환</span>
            <div className={styles.cycleFlow}>
              <span className={styles.cycleStep}>수면 저하</span>
              <span className={styles.cycleArrow}>→</span>
              <span className={styles.cycleStep}>자율신경 불균형</span>
              <span className={styles.cycleArrow}>→</span>
              <span className={styles.cycleStep}>증상 악화</span>
              <span className={styles.cycleArrowDown}>↻</span>
            </div>
          </div>

          {/* 선순환 */}
          <div className={styles.cycleBox + " " + styles.cycleGood}>
            <span className={styles.cycleLabel}>만들어갈 선순환</span>
            <div className={styles.cycleFlow}>
              <span className={styles.cycleStep}>좋은 수면</span>
              <span className={styles.cycleArrow}>→</span>
              <span className={styles.cycleStep}>자율신경 회복</span>
              <span className={styles.cycleArrow}>→</span>
              <span className={styles.cycleStep}>증상 완화</span>
              <span className={styles.cycleArrowDown}>↻</span>
            </div>
          </div>

          {/* CTA: 트래커 시작 전에만 표시 */}
          {!isTrackerStarted() && (
            <div className={styles.ctaArea}>
              <p className={styles.ctaText}>
                {result.total <= 5
                  ? "지금의 좋은 수면을 유지하는 방법,\n다음 세션에서 알아보세요."
                  : result.total <= 10
                  ? "작은 수면 습관 하나가\n이 증상들을 바꿀 수 있어요."
                  : result.total <= 15
                  ? "다음 세션이\n회복의 시작점이 될 수 있어요."
                  : "전문적인 수면 관리가\n자율신경 회복의 열쇠입니다."}
              </p>
              <button className={styles.ctaBtn} onClick={handleCTAClick}>
                {ctaText}
              </button>
            </div>
          )}
        </div>

        {/* tracker 이미 시작한 경우: 수면 기록으로 돌아가기 */}
        {isTrackerStarted() && (
          <button
            className={styles.backToTrackerBtn}
            onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            ← 수면 기록으로 돌아가기
          </button>
        )}
      </div>
    );
  }

  // ── 설문 화면 ──
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>수면 품질 자가 진단</h2>
        <p className={styles.subtitle}>
          Pittsburgh Sleep Quality Index (PSQI)
        </p>
        <p className={styles.instruction}>
          지난 한 달 동안의 평소 수면 습관에 대해 답변해 주세요.
        </p>
      </div>

      {/* Q1~Q4: 주관식 */}
      <div className={styles.section}>
        <div className={styles.questionGroup}>
          <label className={styles.questionLabel}>
            1. 지난 한 달 동안 보통 밤에 몇 시에 잠자리에 들었습니까?
          </label>
          <TimeSelect
            value={answers.q1}
            onChange={(v) => updateAnswer("q1", v)}
            label="잠자리에 든 시간"
          />
        </div>

        <div className={styles.questionGroup}>
          <label className={styles.questionLabel}>
            2. 매일 밤 잠들기까지 걸린 시간은 보통 몇 분입니까?
          </label>
          <div className={styles.inputRow}>
            <input
              type="number"
              className={styles.numberInput}
              value={answers.q2}
              onChange={(e) => updateAnswer("q2", e.target.value)}
              min={0}
              max={300}
              placeholder="0"
            />
            <span className={styles.inputUnit}>분</span>
          </div>
        </div>

        <div className={styles.questionGroup}>
          <label className={styles.questionLabel}>
            3. 보통 아침에 몇 시에 일어났습니까?
          </label>
          <TimeSelect
            value={answers.q3}
            onChange={(v) => updateAnswer("q3", v)}
            label="기상 시간"
          />
        </div>

        <div className={styles.questionGroup}>
          <label className={styles.questionLabel}>
            4. 실제로 밤에 몇 시간이나 잤나요?
            <span className={styles.questionHint}>
              (이것은 실제로 침대에 누워 보낸 시간과 다를 수 있습니다.)
            </span>
          </label>
          <div className={styles.inputRow}>
            <input
              type="number"
              className={styles.numberInput}
              value={answers.q4}
              onChange={(e) => updateAnswer("q4", e.target.value)}
              min={0}
              max={24}
              step={0.5}
              placeholder="0"
            />
            <span className={styles.inputUnit}>시간</span>
          </div>
        </div>
      </div>

      {/* Q5: 수면 방해 요인 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          5. 다음과 같은 이유로 잠들기 어려웠던 적이 얼마나 됩니까?
        </h3>

        {[
          { key: "q5a" as const, text: "a. 30분 이내에 잠들 수 없음" },
          { key: "q5b" as const, text: "b. 한밤중이나 이른 아침에 깨어남" },
          { key: "q5c" as const, text: "c. 화장실을 사용하기 위해 일어나야 함" },
          { key: "q5d" as const, text: "d. 편안하게 숨을 쉴 수 없음" },
          { key: "q5e" as const, text: "e. 기침이나 코골이를 크게 함" },
          { key: "q5f" as const, text: "f. 너무 춥다고 느낌" },
          { key: "q5g" as const, text: "g. 너무 덥다고 느낌" },
          { key: "q5h" as const, text: "h. 나쁜 꿈을 꿈" },
          { key: "q5i" as const, text: "i. 통증이 있음" },
          { key: "q5j" as const, text: "j. 기타 사유" },
        ].map(({ key, text }) => (
          <FrequencyQuestion
            key={key}
            label={text}
            value={answers[key]}
            onChange={(v) => updateAnswer(key, v)}
          />
        ))}
      </div>

      {/* Q6 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          6. 수면에 도움이 되는 약을 얼마나 자주 복용하셨나요?
        </h3>
        <FrequencyQuestion
          label=""
          value={answers.q6}
          onChange={(v) => updateAnswer("q6", v)}
          hideLabel
        />
      </div>

      {/* Q7 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          7. 운전, 식사, 사회 활동 중에 깨어 있기 어려웠던 적이 얼마나 자주 있었습니까?
        </h3>
        <FrequencyQuestion
          label=""
          value={answers.q7}
          onChange={(v) => updateAnswer("q7", v)}
          hideLabel
        />
      </div>

      {/* Q8 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          8. 일을 완수하는 데 필요한 열성을 유지하는 데 얼마나 어려움이 있었습니까?
        </h3>
        <div className={styles.radioGroup}>
          {[
            { value: 0, label: "전혀 문제 없음" },
            { value: 1, label: "아주 사소한 문제만 있음" },
            { value: 2, label: "약간 문제" },
            { value: 3, label: "매우 큰 문제" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`${styles.radioOption} ${
                answers.q8 === opt.value ? styles.radioOptionSelected : ""
              }`}
            >
              <input
                type="radio"
                name="q8"
                className={styles.radioInput}
                checked={answers.q8 === opt.value}
                onChange={() => updateAnswer("q8", opt.value)}
              />
              <span className={styles.radioMark} />
              <span className={styles.radioText}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q9 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          9. 전반적인 수면의 질을 어떻게 평가하시나요?
        </h3>
        <div className={styles.radioGroup}>
          {[
            { value: 0, label: "매우 좋은" },
            { value: 1, label: "꽤 좋은" },
            { value: 2, label: "꽤 나쁜" },
            { value: 3, label: "아주 나쁜" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`${styles.radioOption} ${
                answers.q9 === opt.value ? styles.radioOptionSelected : ""
              }`}
            >
              <input
                type="radio"
                name="q9"
                className={styles.radioInput}
                checked={answers.q9 === opt.value}
                onChange={() => updateAnswer("q9", opt.value)}
              />
              <span className={styles.radioMark} />
              <span className={styles.radioText}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className={styles.submitSection}>
        <button
          className={`${styles.submitBtn} ${
            !isComplete() ? styles.submitBtnDisabled : ""
          }`}
          onClick={handleSubmit}
          disabled={!isComplete() || saving}
        >
          {saving ? "저장 중..." : "결과 확인하기"}
        </button>
        {!isComplete() && (
          <p className={styles.submitHint}>모든 문항에 답변해 주세요.</p>
        )}
        {standalone && onSkip && (
          <button
            className={styles.skipBtn}
            onClick={onSkip}
          >
            {skipText}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 빈도 선택 공통 컴포넌트 ── */
function FrequencyQuestion({
  label,
  value,
  onChange,
  hideLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className={styles.freqQuestion}>
      {!hideLabel && label && (
        <span className={styles.freqLabel}>{label}</span>
      )}
      <div className={styles.radioGroup}>
        {FREQ_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`${styles.radioOption} ${
              value === opt.value ? styles.radioOptionSelected : ""
            }`}
          >
            <input
              type="radio"
              className={styles.radioInput}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className={styles.radioMark} />
            <span className={styles.radioText}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
