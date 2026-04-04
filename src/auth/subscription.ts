// src/auth/subscription.ts
// =======================================================
// 고객 구독 상태 판별 유틸리티
// - 서버 API 연동 (DynamoDB + Lambda)
// - storage 레이어 캐시/폴백 용도로 유지
// =======================================================

import type {
  SubscriptionType,
  UserSubscription,
  WatchRecord,
  GiftCycle,
  BalanceUserState,
} from "@/types/subscription";
import * as storage from "@/lib/storage";

// ─────────────────────────────────────────
// 캐시 키
// ─────────────────────────────────────────
const KEY_SUBSCRIPTION = "balance_subscription";
const KEY_WATCH_RECORDS = "balance_watch_records";
const KEY_GIFT_CYCLE = "balance_gift_cycle";
const KEY_MIGRATION_DONE = "balance_server_migration_done";
const KEY_SUBSCRIPTION_PENDING = "subscription_aws_pending";
const KEY_SUBSCRIPTION_PENDING_PAYLOAD = "subscription_pending_payload";
const KEY_WATCH_RECORDS_PENDING = "balance_watch_records_aws_pending";
const KEY_GIFT_CYCLE_PENDING = "balance_gift_cycle_aws_pending";

function isBrowser() {
  return typeof window !== "undefined";
}

/** 유효한 인증 토큰 가져오기 (만료 시 자동 갱신) */
async function getAuthToken(): Promise<string | null> {
  if (!isBrowser()) return null;

  try {
    const { ensureValidToken } = await import("./tokenManager");
    const tokens = await ensureValidToken();
    return tokens?.idToken ?? null;
  } catch {
    // 갱신 실패 시 기존 토큰 반환 (서버에서 거부할 수 있음)
    return storage.getRaw("user_id_token");
  }
}

// ─────────────────────────────────────────
// 인메모리 캐시 (동일 세션 내 중복 API 호출 방지)
// ─────────────────────────────────────────
const MEMORY_CACHE_TTL = 30_000; // 30초
const memoryCache = new Map<string, { data: UserSubscription; ts: number }>();

function getFromMemoryCache(programId: string): UserSubscription | null {
  const entry = memoryCache.get(programId);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEMORY_CACHE_TTL) {
    memoryCache.delete(programId);
    return null;
  }
  return entry.data;
}

function setMemoryCache(sub: UserSubscription): void {
  memoryCache.set(sub.programId, { data: sub, ts: Date.now() });
}

// ─────────────────────────────────────────
// 1) 구독 상태 조회
// ─────────────────────────────────────────

/** 기본 구독 상태 (둘러보는 고객) */
function defaultSubscription(programId: string): UserSubscription {
  return {
    userId: "",
    programId,
    subscriptionType: "browser",
    startDate: null,
    currentWeek: 1,
    status: "active",
    pausedAt: null,
    trialEndDate: null,
  };
}

/** storage 캐시에서 구독 정보 읽기 */
function getSubscriptionFromCache(programId: string): UserSubscription {
  if (!isBrowser()) return defaultSubscription(programId);

  try {
    storage.migrateKey(`${KEY_SUBSCRIPTION}_${programId}`);
    const raw = storage.get(`${KEY_SUBSCRIPTION}_${programId}`);
    if (!raw) return defaultSubscription(programId);
    return JSON.parse(raw) as UserSubscription;
  } catch {
    return defaultSubscription(programId);
  }
}

/** storage 캐시에 구독 정보 저장 */
function saveSubscriptionToCache(sub: UserSubscription): void {
  if (!isBrowser()) return;
  storage.set(
    `${KEY_SUBSCRIPTION}_${sub.programId}`,
    JSON.stringify(sub)
  );
}

/**
 * 서버에서 구독 정보 조회 (API 호출)
 * - 성공 시 storage 캐시에도 저장
 * - 실패 시 storage 폴백
 */
export async function getSubscription(programId: string): Promise<UserSubscription> {
  // 인메모리 캐시 히트 → API 호출 생략
  const cached = getFromMemoryCache(programId);
  if (cached) return cached;

  const token = await getAuthToken();

  // 토큰 없으면 캐시에서 읽기 (비로그인 상태)
  if (!token) {
    return getSubscriptionFromCache(programId);
  }

  try {
    const res = await fetch(
      `/api/user/subscription?programId=${encodeURIComponent(programId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.warn("[getSubscription] API failed, using cache:", res.status);
      return getSubscriptionFromCache(programId);
    }

    const data = await res.json();
    const sub = data.subscription as UserSubscription;

    // 캐시에 저장 (storage + 인메모리)
    saveSubscriptionToCache(sub);
    setMemoryCache(sub);

    return sub;
  } catch (err) {
    console.warn("[getSubscription] API error, using cache:", err);
    return getSubscriptionFromCache(programId);
  }
}

/**
 * 동기 버전: storage 캐시에서만 읽기
 * - 이미 getSubscription()으로 캐시가 채워진 후 사용
 * - canPlayVideo 등 동기 함수에서 사용
 */
export function getSubscriptionSync(programId: string): UserSubscription {
  return getSubscriptionFromCache(programId);
}

/**
 * 로그인 직후 모든 프로그램 구독 상태를 병렬 프리페치
 * - storage + 인메모리 캐시에 저장 → 홈 진입 시 즉시 표시
 * - fire-and-forget으로 호출해도 안전 (실패해도 홈에서 재조회)
 */
export async function prefetchSubscriptions(): Promise<void> {
  try {
    const { PROGRAMS_LIST } = await import("@/config/programs");
    await Promise.all(
      PROGRAMS_LIST.map((prog) => getSubscription(prog.id))
    );
  } catch {
    // 실패해도 무시 — 홈에서 다시 조회됨
  }
}

/**
 * 서버에 구독 정보 저장 (API 호출)
 * - 성공 시 storage 캐시에도 저장
 */
export async function saveSubscription(sub: UserSubscription): Promise<boolean> {
  const token = await getAuthToken();

  // 캐시에 항상 저장 (로컬 우선)
  saveSubscriptionToCache(sub);

  // 토큰 없으면 pending 설정
  if (!token) {
    storage.set(KEY_SUBSCRIPTION_PENDING, "true");
    storage.setJSON(KEY_SUBSCRIPTION_PENDING_PAYLOAD, sub);
    return true;
  }

  try {
    const res = await fetch("/api/user/subscription", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        programId: sub.programId,
        subscriptionType: sub.subscriptionType,
        startDate: sub.startDate,
        status: sub.status,
        pausedAt: sub.pausedAt,
        trialEndDate: sub.trialEndDate,
      }),
    });

    if (!res.ok) {
      console.error("[saveSubscription] API failed:", res.status);
      storage.set(KEY_SUBSCRIPTION_PENDING, "true");
      storage.setJSON(KEY_SUBSCRIPTION_PENDING_PAYLOAD, sub);
      return false;
    }

    const data = await res.json();
    if (data.subscription) {
      const saved = data.subscription as UserSubscription;
      saveSubscriptionToCache(saved);
      setMemoryCache(saved);
    }

    // 성공 시 pending 플래그 제거
    storage.remove(KEY_SUBSCRIPTION_PENDING);
    storage.remove(KEY_SUBSCRIPTION_PENDING_PAYLOAD);

    return true;
  } catch (err) {
    console.error("[saveSubscription] API error:", err);
    storage.set(KEY_SUBSCRIPTION_PENDING, "true");
    storage.setJSON(KEY_SUBSCRIPTION_PENDING_PAYLOAD, sub);
    return false;
  }
}

// ─────────────────────────────────────────
// 2) 고객 유형 판별
// ─────────────────────────────────────────

export function getSubscriptionType(programId: string): SubscriptionType {
  const sub = getSubscriptionSync(programId);
  return sub.subscriptionType;
}

/** 고객이 현재 영상을 재생할 수 있는지 판별 (동기 - 캐시 기반) */
export function canPlayVideo(
  programId: string,
  weekNumber: number
): {
  allowed: boolean;
  reason: "ok" | "payment_required" | "week_locked" | "expired";
} {
  const sub = getSubscriptionSync(programId);

  // 둘러보는 고객 (프로그램 미선택/선택): 1주차는 전체 시청 허용, 나머지는 결제 필요
  if (sub.subscriptionType === "browser" || sub.subscriptionType === "browser_selected") {
    if (weekNumber === 1) {
      return { allowed: true, reason: "ok" };
    }
    return { allowed: false, reason: "payment_required" };
  }

  // 유료 후 중단 / 무료 후 미전환 고객: 재결제 필요
  if (sub.subscriptionType === "paid_stopped" || sub.subscriptionType === "free_stopped") {
    return { allowed: false, reason: "expired" };
  }

  // 일시 정지 / 만료 / 취소 상태
  if (sub.status === "paused" || sub.status === "expired" || sub.status === "cancelled") {
    return { allowed: false, reason: "expired" };
  }

  // 무료 체험 고객: 1주차만 허용
  if (sub.subscriptionType === "free_trial") {
    if (weekNumber > 1) {
      return { allowed: false, reason: "payment_required" };
    }
    return { allowed: true, reason: "ok" };
  }

  // 유료 고객: 현재 주차까지 허용
  if (sub.subscriptionType === "paid") {
    if (weekNumber > sub.currentWeek) {
      return { allowed: false, reason: "week_locked" };
    }
    return { allowed: true, reason: "ok" };
  }

  return { allowed: false, reason: "payment_required" };
}

// ─────────────────────────────────────────
// 3) 프로그램 주차 계산
// ─────────────────────────────────────────

/** 시작일로부터 현재 프로그램 주차 계산 */
export function calculateCurrentWeek(startDate: string | null): number {
  if (!startDate) return 1;

  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/** 현재 프로그램 주차의 시작일과 종료일 반환 */
export function getWeekRange(
  startDate: string | null,
  weekNumber: number
): { weekStart: Date; weekEnd: Date } {
  const start = startDate ? new Date(startDate) : new Date();
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return { weekStart, weekEnd };
}

/** 다음 주차까지 남은 일수 */
export function daysUntilNextWeek(startDate: string | null, currentWeek: number): number {
  if (!startDate) return 7;

  const { weekEnd } = getWeekRange(startDate, currentWeek);
  const now = new Date();
  const diffMs = weekEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ─────────────────────────────────────────
// 4) 시청 기록 관리
//    원칙: AWS가 원본(source of truth), localStorage는 캐시
//    - 읽기: 서버 우선 조회 → 실패 시 localStorage 폴백
//    - 쓰기: localStorage 즉시 저장 + 서버 비동기 저장
// ─────────────────────────────────────────

/** 시청 기록 불러오기 (동기 — localStorage 캐시에서만 읽기) */
export function getWatchRecords(programId: string): WatchRecord[] {
  if (!isBrowser()) return [];

  try {
    storage.migrateKey(`${KEY_WATCH_RECORDS}_${programId}`);
    const raw = storage.get(`${KEY_WATCH_RECORDS}_${programId}`);
    if (!raw) return [];
    return JSON.parse(raw) as WatchRecord[];
  } catch {
    return [];
  }
}

/** localStorage 캐시에 시청 기록 배열 저장 */
function saveWatchRecordsToCache(programId: string, records: WatchRecord[]): void {
  if (!isBrowser()) return;
  storage.set(
    `${KEY_WATCH_RECORDS}_${programId}`,
    JSON.stringify(records)
  );
}

/**
 * 서버에서 시청 기록을 조회하여 localStorage 캐시를 갱신 (비동기)
 * - 성공 시: 서버 데이터로 캐시를 교체하고 반환
 * - 실패 시: localStorage 캐시에서 읽어서 반환
 */
export async function fetchWatchRecordsFromServer(programId: string): Promise<WatchRecord[]> {
  const token = await getAuthToken();

  // 토큰 없으면 캐시에서 읽기 (비로그인 상태)
  if (!token) {
    return getWatchRecords(programId);
  }

  try {
    const res = await fetch(
      `/api/user/watch-records?programId=${encodeURIComponent(programId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.warn("[fetchWatchRecords] API failed, using cache:", res.status);
      return getWatchRecords(programId);
    }

    const data = await res.json();
    const items = (data.items || []) as WatchRecord[];

    // 서버 데이터로 캐시 갱신
    saveWatchRecordsToCache(programId, items);

    return items;
  } catch (err) {
    console.warn("[fetchWatchRecords] API error, using cache:", err);
    return getWatchRecords(programId);
  }
}

/**
 * 시청 기록 저장 (비동기)
 * - localStorage 즉시 저장 (UI 즉시 반영)
 * - 서버에도 비동기 저장 (서버 실패 시 localStorage에만 남음)
 */
export async function saveWatchRecord(record: WatchRecord): Promise<void> {
  if (!isBrowser()) return;

  // 1) localStorage 즉시 저장 (기존 로직 유지)
  const records = getWatchRecords(record.programId);

  const existingIdx = records.findIndex(
    (r) => r.watchDate === record.watchDate && r.weekNumber === record.weekNumber
  );

  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.push(record);
  }

  saveWatchRecordsToCache(record.programId, records);

  // 2) 서버에도 비동기 저장 (실패해도 localStorage에는 이미 저장됨)
  const token = await getAuthToken();
  if (!token) return; // 비로그인 상태면 서버 저장 스킵

  try {
    const res = await fetch("/api/user/watch-records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        programId: record.programId,
        weekNumber: record.weekNumber,
        watchDate: record.watchDate,
        watchDurationSeconds: record.watchDurationSeconds,
        isCompleted: record.isCompleted,
      }),
    });

    if (res.ok) {
      storage.remove(`${KEY_WATCH_RECORDS_PENDING}_${record.programId}`);
    } else {
      storage.set(`${KEY_WATCH_RECORDS_PENDING}_${record.programId}`, "true");
      console.warn("[saveWatchRecord] Server save failed:", res.status);
    }
  } catch (err) {
    // 서버 저장 실패 → pending 플래그 설정 (다음 접속 시 재시도)
    storage.set(`${KEY_WATCH_RECORDS_PENDING}_${record.programId}`, "true");
    console.warn("[saveWatchRecord] Server save failed:", err);
  }
}

/** 특정 프로그램 주차의 시청 완료 일수 계산 */
export function getCompletedDaysInWeek(
  programId: string,
  startDate: string | null,
  weekNumber: number
): number {
  const records = getWatchRecords(programId);
  const { weekStart, weekEnd } = getWeekRange(startDate, weekNumber);

  return records.filter((r) => {
    if (r.weekNumber !== weekNumber) return false;
    if (!r.isCompleted) return false;

    const d = new Date(r.watchDate);
    return d >= weekStart && d <= weekEnd;
  }).length;
}

/** 시청 완료된 날짜 Set 반환 (달력 표시용) */
export function getCompletedDates(programId: string): Set<string> {
  const records = getWatchRecords(programId);
  const dates = new Set<string>();

  for (const r of records) {
    if (r.isCompleted) {
      dates.add(r.watchDate);
    }
  }

  return dates;
}

// ─────────────────────────────────────────
// 5) 선물 사이클 관리
//    원칙: AWS가 원본(source of truth), localStorage는 캐시
//    - 읽기: 서버 우선 조회 → 실패 시 localStorage 폴백
//    - 쓰기: localStorage 즉시 저장 + 서버 비동기 저장
// ─────────────────────────────────────────

/** 기본 선물 사이클 */
function defaultGiftCycle(programId: string): GiftCycle {
  return {
    userId: "",
    programId,
    cycleNumber: 1,
    qualifiedWeeks: 0,
    giftUnlockedAt: null,
    giftExpiresAt: null,
    giftVideoId: null,
  };
}

/** 선물 사이클 불러오기 (동기 — localStorage 캐시에서만 읽기) */
export function getGiftCycle(programId: string): GiftCycle {
  if (!isBrowser()) return defaultGiftCycle(programId);

  try {
    storage.migrateKey(`${KEY_GIFT_CYCLE}_${programId}`);
    const raw = storage.get(`${KEY_GIFT_CYCLE}_${programId}`);
    if (!raw) return defaultGiftCycle(programId);
    return JSON.parse(raw) as GiftCycle;
  } catch {
    return defaultGiftCycle(programId);
  }
}

/** localStorage 캐시에 선물 사이클 저장 */
function saveGiftCycleToCache(cycle: GiftCycle): void {
  if (!isBrowser()) return;
  storage.set(
    `${KEY_GIFT_CYCLE}_${cycle.programId}`,
    JSON.stringify(cycle)
  );
}

/**
 * 서버에서 선물 사이클을 조회하여 localStorage 캐시를 갱신 (비동기)
 * - 성공 시: 서버 데이터로 캐시를 교체하고 반환
 * - 실패 시: localStorage 캐시에서 읽어서 반환
 */
export async function fetchGiftCycleFromServer(programId: string): Promise<GiftCycle> {
  const token = await getAuthToken();

  // 토큰 없으면 캐시에서 읽기 (비로그인 상태)
  if (!token) {
    return getGiftCycle(programId);
  }

  try {
    const res = await fetch(
      `/api/user/gift-cycles?programId=${encodeURIComponent(programId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.warn("[fetchGiftCycle] API failed, using cache:", res.status);
      return getGiftCycle(programId);
    }

    const data = await res.json();
    const current = data.current as GiftCycle | null;

    if (current) {
      // 서버 데이터로 캐시 갱신
      saveGiftCycleToCache(current);
      return current;
    }

    // 서버에 데이터가 없으면 기본값 반환
    return defaultGiftCycle(programId);
  } catch (err) {
    console.warn("[fetchGiftCycle] API error, using cache:", err);
    return getGiftCycle(programId);
  }
}

/**
 * 선물 사이클 저장 (비동기)
 * - localStorage 즉시 저장 (UI 즉시 반영)
 * - 서버에도 비동기 저장 (서버 실패 시 localStorage에만 남음)
 */
export async function saveGiftCycle(cycle: GiftCycle): Promise<void> {
  if (!isBrowser()) return;

  // 1) localStorage 즉시 저장
  saveGiftCycleToCache(cycle);

  // 2) 서버에도 비동기 저장
  const token = await getAuthToken();
  if (!token) return; // 비로그인 상태면 서버 저장 스킵

  try {
    const res = await fetch("/api/user/gift-cycles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        programId: cycle.programId,
        cycleNumber: cycle.cycleNumber,
        qualifiedWeeks: cycle.qualifiedWeeks,
        giftUnlockedAt: cycle.giftUnlockedAt,
        giftExpiresAt: cycle.giftExpiresAt,
        giftVideoId: cycle.giftVideoId,
      }),
    });

    if (res.ok) {
      storage.remove(`${KEY_GIFT_CYCLE_PENDING}_${cycle.programId}`);
    } else {
      storage.set(`${KEY_GIFT_CYCLE_PENDING}_${cycle.programId}`, "true");
      console.warn("[saveGiftCycle] Server save failed:", res.status);
    }
  } catch (err) {
    // 서버 저장 실패 → pending 플래그 설정 (다음 접속 시 재시도)
    storage.set(`${KEY_GIFT_CYCLE_PENDING}_${cycle.programId}`, "true");
    console.warn("[saveGiftCycle] Server save failed:", err);
  }
}

/** 선물 영상 접근 가능 여부 (해금 후 7일 이내인지) */
export function isGiftAccessible(cycle: GiftCycle): boolean {
  if (!cycle.giftUnlockedAt || !cycle.giftExpiresAt) return false;

  const now = new Date();
  const expires = new Date(cycle.giftExpiresAt);
  return now <= expires;
}

/** 선물 진행도 메시지 생성 */
export function getGiftProgressMessage(
  cycle: GiftCycle,
  userName?: string | null
): string | null {
  if (cycle.qualifiedWeeks >= 4) {
    if (isGiftAccessible(cycle)) {
      return "축하합니다! 🎁 선물 영상이 도착했어요!";
    }
    return null; // 이미 만료됨
  }

  const remaining = 4 - cycle.qualifiedWeeks;

  if (cycle.qualifiedWeeks === 0 && userName) {
    return `주 3일 이상 4주 동안 실천하면 ${userName}님을 위한 선물이 준비되어 있어요!`;
  }

  if (cycle.qualifiedWeeks > 0) {
    return `4주 중 ${cycle.qualifiedWeeks}주 달성! 선물까지 ${remaining}주 남았어요`;
  }

  return null;
}

// ─────────────────────────────────────────
// 5-b) 롤링 윈도우 기반 선물 달성 계산
// ─────────────────────────────────────────

/**
 * 프로그램 주차 기준으로 선물 달성 주수를 계산합니다.
 * - 프로그램 시작일(startDate) 기준으로 매 7일이 한 주차
 * - 각 주차 안에서 시청 완료(isCompleted=true) 날이 3일 이상이면 그 주는 "달성"
 * - 달성 주수는 누적 (연속이 아니어도 됨, 리셋 없음)
 * - 선물은 누적 4주, 8주, 12주... 달성 시 해금
 * - free_trial 1주차도 포함
 */
export function countQualifyingWeeksRolling(programId: string): number {
  const records = getWatchRecords(programId);
  const sub = getSubscriptionSync(programId);

  // startDate 없으면 계산 불가
  if (!sub.startDate) return 0;

  // 시청 완료된 날짜만 추출 (중복 제거)
  const completedDates = Array.from(
    new Set(records.filter((r) => r.isCompleted).map((r) => r.watchDate))
  );

  if (completedDates.length === 0) return 0;

  const startDate = new Date(sub.startDate);
  startDate.setHours(0, 0, 0, 0);

  // 현재 주차 계산 (몇 주차까지 검사해야 하는지)
  const now = new Date();
  const totalWeeks = Math.ceil(
    (now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  let qualifiedWeeks = 0;

  // 각 프로그램 주차별로 달성 여부 판정
  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + week * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 이 주차 안에서 시청 완료한 고유 날짜 수
    const daysInWeek = completedDates.filter((dateStr) => {
      const d = new Date(dateStr);
      return d >= weekStart && d <= weekEnd;
    }).length;

    if (daysInWeek >= 3) {
      qualifiedWeeks++;
    }
  }

  return qualifiedWeeks;
}

/** 최근 N일 중 시청 완료 일수 */
export function getDaysInRecentWindow(programId: string, windowDays: number = 7): number {
  const records = getWatchRecords(programId);
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));
  windowStart.setHours(0, 0, 0, 0);

  const uniqueDates = new Set(
    records
      .filter((r) => r.isCompleted)
      .map((r) => r.watchDate)
      .filter((dateStr) => {
        const d = new Date(dateStr);
        return d >= windowStart && d <= now;
      })
  );

  return uniqueDates.size;
}

/** 응원/축하 메시지 (최근 7일 시청 일수 + 달성 주수 기반) */
export function getEncouragementMessage(
  daysInRecentWindow: number,
  qualifiedWeeksRolling: number,
  userName?: string | null
): string | null {
  const name = userName || "회원";

  // ── 선물 달성 축하! (4주, 8주, 12주... 달성 시) ──
  const completedCycles = Math.floor(qualifiedWeeksRolling / 4);
  if (qualifiedWeeksRolling > 0 && qualifiedWeeksRolling % 4 === 0) {
    if (completedCycles === 1) {
      return `🎉 축하해요, ${name}님! 4주간의 실천으로 첫 번째 선물을 받으셨어요! 다음 4주에도 새로운 선물이 준비되어 있어요.`;
    }
    return `🎉 ${name}님, 정말 대단해요! ${completedCycles}번째 선물까지 받으셨네요! 꾸준한 실천이 빛나고 있어요.`;
  }

  const remainingWeeks = 4 - (qualifiedWeeksRolling % 4);
  const isLastWeek = remainingWeeks === 1; // 4주차 (선물 직전)

  // ── 4주차(선물 직전 주): 1~2일일 때 특별 메시지 ──
  if (isLastWeek) {
    if (daysInRecentWindow === 1) {
      return `${name}님, 2번만 더 하면 다음 주에 선물 받으실 수 있어요!`;
    }
    if (daysInRecentWindow === 2) {
      return `${name}님, 1번만 더 하면 다음 주에 선물 받으실 수 있어요!`;
    }
  }

  // ── 3일 이상 달성: 칭찬 + 남은 주수 안내 ──
  if (daysInRecentWindow >= 3) {
    if (remainingWeeks <= 0) return null; // 이미 선물 수령 가능
    return `${name}님, 너무 잘하고 계세요! 앞으로 ${remainingWeeks}주만 더 하면 선물을 받으실 수 있어요!`;
  }

  // ── 0일: 완전히 쉬고 있는 경우 ──
  if (daysInRecentWindow === 0) {
    return `${name}님, 언제든 다시 시작할 수 있어요. 오늘 딱 15분만 해볼까요?`;
  }

  // ── 1일: 시작은 했지만 부족한 경우 ──
  if (daysInRecentWindow === 1) {
    return `${name}님, 좋은 출발이예요! 이번 주에 2번만 더 하면 선물에 한 걸음 더 가까워져요.`;
  }

  // ── 2일: 거의 다 온 경우 ──
  return `${name}님, 거의 다 왔어요! 딱 1번만 더 하면 이번 주 달성이에요!`;
}

/** 선물 예상 수령일 계산 (롤링 달성 주수 기반) */
export function getExpectedGiftDate(
  cycle: GiftCycle,
  qualifiedWeeksRolling?: number
): Date | null {
  const qw = qualifiedWeeksRolling ?? cycle.qualifiedWeeks;

  // 이미 선물 수령 가능하면 null
  if (qw >= 4 && isGiftAccessible(cycle)) return null;

  const remaining = 4 - (qw % 4); // 다음 선물까지 남은 주
  const expected = new Date();
  expected.setDate(expected.getDate() + remaining * 7);
  return expected;
}

/** 날짜를 "YYYY년 M월 D일" 형식으로 포맷 */
export function formatKoreanDate(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// ─────────────────────────────────────────
// 6) localStorage → 서버 최초 마이그레이션
//    - 로그인 상태에서 서버에 데이터가 없고 localStorage에 있으면
//      한 번만 서버로 업로드
//    - 마이그레이션 완료 후 플래그를 남겨 재실행 방지
// ─────────────────────────────────────────

/**
 * localStorage에만 존재하는 시청 기록·선물 사이클을
 * 서버로 한 번만 업로드하는 마이그레이션 함수.
 *
 * 조건:
 * 1) 로그인 상태 (토큰 존재)
 * 2) 아직 마이그레이션을 한 적이 없음 (플래그 확인)
 * 3) 서버에 해당 데이터가 비어있음
 * 4) localStorage에 데이터가 있음
 */
async function migrateLocalDataToServer(programId: string): Promise<void> {
  if (!isBrowser()) return;

  // 이미 마이그레이션 완료된 경우 스킵
  const flag = storage.get(`${KEY_MIGRATION_DONE}_${programId}`);
  if (flag === "true") return;

  const token = await getAuthToken();
  if (!token) return; // 비로그인 상태면 스킵

  try {
    // ── 시청 기록 마이그레이션 ──
    const localRecords = getWatchRecords(programId);

    if (localRecords.length > 0) {
      // 서버에 데이터가 있는지 확인
      const serverRes = await fetch(
        `/api/user/watch-records?programId=${encodeURIComponent(programId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        const serverItems = serverData.items || [];

        // 서버에 데이터가 없을 때만 업로드
        if (serverItems.length === 0) {
          for (const record of localRecords) {
            await fetch("/api/user/watch-records", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                programId: record.programId,
                weekNumber: record.weekNumber,
                watchDate: record.watchDate,
                watchDurationSeconds: record.watchDurationSeconds,
                isCompleted: record.isCompleted,
              }),
            });
          }
          console.info(`[migration] ${localRecords.length}건의 시청 기록을 서버로 업로드했습니다.`);
        }
      }
    }

    // ── 선물 사이클 마이그레이션 ──
    const localCycle = getGiftCycle(programId);

    // 기본값이 아닌 경우에만 (실제 데이터가 있는 경우)
    if (localCycle.qualifiedWeeks > 0 || localCycle.giftUnlockedAt) {
      const serverRes = await fetch(
        `/api/user/gift-cycles?programId=${encodeURIComponent(programId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (serverRes.ok) {
        const serverData = await serverRes.json();

        // 서버에 데이터가 없을 때만 업로드
        if (!serverData.current) {
          await fetch("/api/user/gift-cycles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              programId: localCycle.programId,
              cycleNumber: localCycle.cycleNumber,
              qualifiedWeeks: localCycle.qualifiedWeeks,
              giftUnlockedAt: localCycle.giftUnlockedAt,
              giftExpiresAt: localCycle.giftExpiresAt,
              giftVideoId: localCycle.giftVideoId,
            }),
          });
          console.info("[migration] 선물 사이클을 서버로 업로드했습니다.");
        }
      }
    }

    // 마이그레이션 완료 플래그 저장
    storage.set(`${KEY_MIGRATION_DONE}_${programId}`, "true");
    console.info("[migration] 마이그레이션 완료 플래그 저장됨.");
  } catch (err) {
    // 마이그레이션 실패해도 앱은 정상 동작 (다음 로드 시 재시도)
    console.warn("[migration] 마이그레이션 실패 (다음 로드 시 재시도):", err);
  }
}

// ─────────────────────────────────────────
// 7) 통합 상태 조회
// ─────────────────────────────────────────

/**
 * Balance 페이지에서 필요한 모든 상태를 한번에 조회 (비동기)
 * - 구독 상태: 서버 API에서 조회
 * - 시청 기록: 서버 우선 조회 + localStorage 폴백 (2단계 완료)
 * - 선물 사이클: 서버 우선 조회 + localStorage 폴백 (3단계 완료)
 */
export async function getBalanceUserState(programId: string): Promise<BalanceUserState> {
  // 최초 1회: localStorage 데이터를 서버로 마이그레이션
  await migrateLocalDataToServer(programId);

  const subscription = await getSubscription(programId);
  const watchRecords = await fetchWatchRecordsFromServer(programId);
  const giftCycle = await fetchGiftCycleFromServer(programId);

  // 현재 주차 재계산
  if (subscription.startDate && subscription.status === "active") {
    subscription.currentWeek = calculateCurrentWeek(subscription.startDate);
  }

  // 이번 주차 시청 일수 (프로그램 주차 기반 - UI 실천 현황용)
  const daysWatchedThisWeek = getCompletedDaysInWeek(
    programId,
    subscription.startDate,
    subscription.currentWeek
  );

  // 프로그램 주차 기준 선물 달성 주수 (누적)
  const qualifiedWeeksRolling = countQualifyingWeeksRolling(programId);

  // 최근 7일 시청 일수
  const daysInRecentWindow = getDaysInRecentWindow(programId, 7);

  // 선물 해금 여부 (누적 4N주 기준: 4주=1번째, 8주=2번째, 12주=3번째...)
  const isGiftWeek = qualifiedWeeksRolling >= 4 * giftCycle.cycleNumber && isGiftAccessible(giftCycle);

  return {
    subscription,
    watchRecords,
    giftCycle,
    isGiftWeek,
    daysWatchedThisWeek,
    qualifiedWeeksRolling,
    daysInRecentWindow,
    encouragementMessage: null, // page에서 userName과 함께 계산
  };
}

// ─────────────────────────────────────────
// 8) Pending 데이터 재전송 (앱 복귀 / 인터넷 복구 시)
//    - Home 페이지의 retryPendingProfileSync() 패턴 적용
//    - 구독 저장 + 시청 기록 + 선물 사이클의 pending 플래그 확인 → 서버 재전송
//    - visibilitychange, online 이벤트에서 호출
// ─────────────────────────────────────────

let subscriptionSyncInProgress = false;

/**
 * 구독 저장의 pending 데이터를 서버에 재전송합니다.
 * - pending 플래그가 있는 경우에만 실행
 * - 중복 실행 방지를 위해 subscriptionSyncInProgress 플래그 사용
 */
export async function retryPendingSubscriptionSync(): Promise<void> {
  if (!isBrowser()) return;
  if (subscriptionSyncInProgress) return;

  const pending = storage.get(KEY_SUBSCRIPTION_PENDING);
  if (pending !== "true") return;

  subscriptionSyncInProgress = true;

  try {
    const token = await getAuthToken();
    if (!token) return;

    const payload = storage.getJSON<UserSubscription>(KEY_SUBSCRIPTION_PENDING_PAYLOAD);
    if (!payload) {
      storage.remove(KEY_SUBSCRIPTION_PENDING);
      return;
    }

    const res = await fetch("/api/user/subscription", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        programId: payload.programId,
        subscriptionType: payload.subscriptionType,
        startDate: payload.startDate,
        status: payload.status,
        pausedAt: payload.pausedAt,
        trialEndDate: payload.trialEndDate,
      }),
    });

    if (res.ok) {
      storage.remove(KEY_SUBSCRIPTION_PENDING);
      storage.remove(KEY_SUBSCRIPTION_PENDING_PAYLOAD);
      console.log("[Subscription] AWS 재업로드 성공");

      const data = await res.json();
      if (data.subscription) {
        saveSubscriptionToCache(data.subscription as UserSubscription);
        setMemoryCache(data.subscription as UserSubscription);
      }
    } else {
      console.warn("[Subscription] AWS 재업로드 실패:", res.status);
    }
  } catch (err) {
    console.warn("[Subscription] AWS 재업로드 중 에러:", err);
  } finally {
    subscriptionSyncInProgress = false;
  }
}

let balanceSyncInProgress = false;

/**
 * 시청 기록/선물 사이클의 pending 데이터를 서버에 재전송합니다.
 * - pending 플래그가 있는 경우에만 실행
 * - 중복 실행 방지를 위해 balanceSyncInProgress 플래그 사용
 * - Home 페이지의 retryPendingProfileSync() 패턴과 동일
 */
export async function retryPendingBalanceSync(programId: string): Promise<void> {
  if (!isBrowser()) return;
  if (balanceSyncInProgress) return;

  const watchPending = storage.get(`${KEY_WATCH_RECORDS_PENDING}_${programId}`);
  const giftPending = storage.get(`${KEY_GIFT_CYCLE_PENDING}_${programId}`);

  if (watchPending !== "true" && giftPending !== "true") return;

  balanceSyncInProgress = true;

  try {
    const token = await getAuthToken();
    if (!token) return;

    // ── 시청 기록 재전송 ──
    if (watchPending === "true") {
      const records = getWatchRecords(programId);
      if (records.length > 0) {
        try {
          let allOk = true;
          for (const record of records) {
            const res = await fetch("/api/user/watch-records", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                programId: record.programId,
                weekNumber: record.weekNumber,
                watchDate: record.watchDate,
                watchDurationSeconds: record.watchDurationSeconds,
                isCompleted: record.isCompleted,
              }),
            });
            if (!res.ok) allOk = false;
          }
          if (allOk) {
            storage.remove(`${KEY_WATCH_RECORDS_PENDING}_${programId}`);
            console.log("[Balance] 시청 기록 AWS 재전송 성공");
          }
        } catch (err) {
          console.warn("[Balance] 시청 기록 AWS 재전송 실패:", err);
        }
      }
    }

    // ── 선물 사이클 재전송 ──
    if (giftPending === "true") {
      const cycle = getGiftCycle(programId);
      if (cycle.qualifiedWeeks > 0 || cycle.giftUnlockedAt) {
        try {
          const res = await fetch("/api/user/gift-cycles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              programId: cycle.programId,
              cycleNumber: cycle.cycleNumber,
              qualifiedWeeks: cycle.qualifiedWeeks,
              giftUnlockedAt: cycle.giftUnlockedAt,
              giftExpiresAt: cycle.giftExpiresAt,
              giftVideoId: cycle.giftVideoId,
            }),
          });
          if (res.ok) {
            storage.remove(`${KEY_GIFT_CYCLE_PENDING}_${programId}`);
            console.log("[Balance] 선물 사이클 AWS 재전송 성공");
          }
        } catch (err) {
          console.warn("[Balance] 선물 사이클 AWS 재전송 실패:", err);
        }
      }
    }
  } finally {
    balanceSyncInProgress = false;
  }
}
