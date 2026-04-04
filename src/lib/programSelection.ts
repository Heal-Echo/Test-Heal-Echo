// src/lib/programSelection.ts
// =======================================================
// 솔루션 선택 통합 관리 (Single Source of Truth)
// - 모든 페이지가 "고객이 솔루션을 선택했는지"를 이 파일을 통해 확인
// - 어디서 선택하든 syncProgramSelection() 하나로 모든 저장소에 기록
// - weekly_habit 키, subscription 캐시, AWS preferences를 모두 동기화
// =======================================================

import * as storage from "@/lib/storage";
import { getUserInfo } from "@/auth/user";
import { USER_API } from "@/config/constants";

// ── 스토리지 키 (weekly-habit page.tsx와 동일) ──
export const SELECTED_PROGRAM_KEY = "weekly_habit_selected_program";
export const PROGRAM_CONFIRMED_KEY = "weekly_habit_program_confirmed";
export const PROGRAM_CHANGE_USED_KEY = "weekly_habit_change_used";
export const PROGRAM_START_KEY = "weekly_habit_program_start_date";

// ── subscription 캐시 키 (subscription.ts와 동일 패턴) ──
const KEY_SUBSCRIPTION = "balance_subscription";

// =======================================================
// 1) 솔루션 선택 여부 확인 (읽기 전용)
//    - 우선순위: weekly_habit 키 → subscription 캐시
//    - 어디서 선택했든 하나라도 기록이 있으면 반환
// =======================================================

/**
 * 현재 고객이 선택한 프로그램 ID를 반환합니다.
 * - weekly_habit 키에 저장된 값을 먼저 확인
 * - 없으면 subscription 캐시에서 programId를 확인
 * - 아무 곳에도 없으면 null 반환 (= 아직 솔루션을 선택하지 않음)
 */
export function getSelectedProgram(): string | null {
  if (typeof window === "undefined") return null;

  // 1순위: weekly_habit 키 (가장 직접적인 선택 기록)
  storage.migrateKey(SELECTED_PROGRAM_KEY);
  const fromWeeklyHabit = storage.get(SELECTED_PROGRAM_KEY);
  if (fromWeeklyHabit) return fromWeeklyHabit;

  // 2순위: subscription 캐시에서 free_trial 또는 paid 프로그램 확인
  // (결제를 완료했지만 weekly_habit 키가 없는 경우)
  try {
    const programs = ["autobalance", "womans-whisper"];
    for (const progId of programs) {
      storage.migrateKey(`${KEY_SUBSCRIPTION}_${progId}`);
      const raw = storage.get(`${KEY_SUBSCRIPTION}_${progId}`);
      if (raw) {
        const sub = JSON.parse(raw);
        if (
          sub.subscriptionType === "free_trial" ||
          sub.subscriptionType === "paid" ||
          sub.subscriptionType === "browser_selected"
        ) {
          return progId;
        }
      }
    }
  } catch {
    // subscription 캐시 파싱 실패 → 무시
  }

  return null;
}

/**
 * 솔루션 선택이 "확정"되었는지 확인합니다.
 * - weekly_habit의 confirmed 키가 "true"인 경우
 * - 또는 subscription이 free_trial/paid인 경우 (결제 = 확정)
 */
export function isSelectionConfirmed(): boolean {
  if (typeof window === "undefined") return false;

  // 1순위: weekly_habit confirmed 키
  storage.migrateKey(PROGRAM_CONFIRMED_KEY);
  if (storage.get(PROGRAM_CONFIRMED_KEY) === "true") return true;

  // 2순위: subscription이 free_trial 또는 paid이면 확정으로 간주
  try {
    const programs = ["autobalance", "womans-whisper"];
    for (const progId of programs) {
      storage.migrateKey(`${KEY_SUBSCRIPTION}_${progId}`);
      const raw = storage.get(`${KEY_SUBSCRIPTION}_${progId}`);
      if (raw) {
        const sub = JSON.parse(raw);
        if (
          sub.subscriptionType === "free_trial" ||
          sub.subscriptionType === "paid"
        ) {
          return true;
        }
      }
    }
  } catch {
    // 무시
  }

  return false;
}

/**
 * 솔루션 1회 변경을 이미 사용했는지 확인합니다.
 */
export function isChangeUsed(): boolean {
  if (typeof window === "undefined") return false;
  storage.migrateKey(PROGRAM_CHANGE_USED_KEY);
  return storage.get(PROGRAM_CHANGE_USED_KEY) === "true";
}

// =======================================================
// 2) 솔루션 선택 동기화 (쓰기)
//    - 한 번 호출하면 모든 저장소에 일관되게 기록
//    - Home, BottomTab, Weekly Habit, Pricing 등 어디서든 이 함수 사용
// =======================================================

/**
 * 솔루션 선택을 모든 저장소에 동기화합니다.
 * - weekly_habit 키 4종 저장 (selected, confirmed, start_date, change_used는 유지)
 * - AWS preferences에 fire-and-forget 저장
 *
 * @param programId - 선택한 프로그램 ID (예: "autobalance")
 * @param options.isChange - 1회 변경인 경우 true (change_used 플래그 설정)
 */
export function syncProgramSelection(
  programId: string,
  options?: { isChange?: boolean }
): void {
  if (typeof window === "undefined") return;

  // 시작일: 기존에 있으면 유지, 없으면 오늘 날짜
  storage.migrateKey(PROGRAM_START_KEY);
  if (!storage.get(PROGRAM_START_KEY)) {
    const today = new Date().toISOString().split("T")[0];
    storage.set(PROGRAM_START_KEY, today);
  }

  // weekly_habit 키 저장
  storage.set(SELECTED_PROGRAM_KEY, programId);
  storage.set(PROGRAM_CONFIRMED_KEY, "true");

  // 1회 변경인 경우
  if (options?.isChange) {
    storage.set(PROGRAM_CHANGE_USED_KEY, "true");
  }

  // AWS preferences에 비동기 저장 (fire-and-forget)
  const prefsToSave: Record<string, string | boolean> = {
    [SELECTED_PROGRAM_KEY]: programId,
    [PROGRAM_CONFIRMED_KEY]: "true",
    [PROGRAM_START_KEY]: storage.get(PROGRAM_START_KEY) || "",
  };
  if (options?.isChange) {
    prefsToSave[PROGRAM_CHANGE_USED_KEY] = "true";
  }

  savePreferencesToAWS(prefsToSave);
}

// ── pending 플래그 키 ──
const PROGRAM_AWS_PENDING_KEY = "program_selection_aws_pending";

// =======================================================
// 3) AWS preferences 저장 헬퍼
//    - weekly-habit page.tsx에서 가져온 로직
//    - 실패해도 로컬에는 이미 저장되어 있으므로 사용자 경험에 영향 없음
//    - 실패 시 pending 플래그 설정 → 다음 접속 시 재시도
// =======================================================

async function savePreferencesToAWS(
  prefs: Record<string, string | boolean>
): Promise<void> {
  try {
    const info = getUserInfo();
    const token = info?.idToken;
    if (!token) {
      storage.set(PROGRAM_AWS_PENDING_KEY, "true");
      return;
    }

    const res = await fetch(USER_API.PREFERENCES, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(prefs),
    });

    if (res.ok) {
      storage.remove(PROGRAM_AWS_PENDING_KEY);
    } else {
      storage.set(PROGRAM_AWS_PENDING_KEY, "true");
      console.warn("[ProgramSelection] AWS 저장 실패:", res.status);
    }
  } catch (err) {
    storage.set(PROGRAM_AWS_PENDING_KEY, "true");
    console.warn("[ProgramSelection] AWS 저장 실패:", err);
  }
}

// =======================================================
// 3-1) Pending 프로그램 선택 재전송
//      - Home 페이지의 retryPendingProfileSync() 패턴과 동일
//      - 앱 복귀(visibilitychange), 인터넷 복구(online) 시 호출
// =======================================================

let programSyncInProgress = false;

export async function retryPendingProgramSync(): Promise<void> {
  if (typeof window === "undefined") return;
  if (programSyncInProgress) return;

  const pending = storage.get(PROGRAM_AWS_PENDING_KEY);
  if (pending !== "true") return;

  programSyncInProgress = true;

  try {
    const info = getUserInfo();
    const token = info?.idToken;
    if (!token) return;

    // 현재 로컬 스토리지에서 프로그램 선택 데이터 수집
    const prefs: Record<string, string> = {};
    const selected = storage.get(SELECTED_PROGRAM_KEY);
    if (selected) prefs[SELECTED_PROGRAM_KEY] = selected;
    const confirmed = storage.get(PROGRAM_CONFIRMED_KEY);
    if (confirmed) prefs[PROGRAM_CONFIRMED_KEY] = confirmed;
    const startDate = storage.get(PROGRAM_START_KEY);
    if (startDate) prefs[PROGRAM_START_KEY] = startDate;
    const changeUsed = storage.get(PROGRAM_CHANGE_USED_KEY);
    if (changeUsed) prefs[PROGRAM_CHANGE_USED_KEY] = changeUsed;

    if (Object.keys(prefs).length === 0) {
      storage.remove(PROGRAM_AWS_PENDING_KEY);
      return;
    }

    const res = await fetch(USER_API.PREFERENCES, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(prefs),
    });

    if (res.ok) {
      storage.remove(PROGRAM_AWS_PENDING_KEY);
      console.log("[ProgramSelection] AWS 재업로드 성공");
    } else {
      console.warn("[ProgramSelection] AWS 재업로드 실패:", res.status);
    }
  } catch (err) {
    console.warn("[ProgramSelection] AWS 재업로드 중 에러:", err);
  } finally {
    programSyncInProgress = false;
  }
}

// =======================================================
// 4) AWS에서 preferences hydrate (읽기)
//    - 로컬 스토리지에 없을 때 AWS에서 데이터를 가져와 복원
//    - Weekly Habit 페이지 마운트 시 사용
// =======================================================

/**
 * AWS에서 프로그램 선택 정보를 가져와 로컬 스토리지에 복원합니다.
 * - 이미 로컬에 데이터가 있으면 아무것도 하지 않음
 * - 반환값: hydrate된 프로그램 ID (없으면 null)
 */
export async function hydrateFromAWS(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 이미 로컬에 있으면 hydrate 불필요
  const existing = getSelectedProgram();
  if (existing) return existing;

  try {
    const info = getUserInfo();
    const token = info?.idToken;
    if (!token) return null;

    const res = await fetch(USER_API.PREFERENCES, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const prefs = json.preferences || {};

    if (prefs[SELECTED_PROGRAM_KEY]) {
      storage.set(SELECTED_PROGRAM_KEY, prefs[SELECTED_PROGRAM_KEY]);
    }
    if (prefs[PROGRAM_CONFIRMED_KEY]) {
      storage.set(PROGRAM_CONFIRMED_KEY, prefs[PROGRAM_CONFIRMED_KEY]);
    }
    if (prefs[PROGRAM_CHANGE_USED_KEY]) {
      storage.set(PROGRAM_CHANGE_USED_KEY, prefs[PROGRAM_CHANGE_USED_KEY]);
    }
    if (prefs[PROGRAM_START_KEY]) {
      storage.set(PROGRAM_START_KEY, prefs[PROGRAM_START_KEY]);
    }

    console.log("[ProgramSelection] AWS에서 환경설정 hydrate 완료");
    return prefs[SELECTED_PROGRAM_KEY] || null;
  } catch (err) {
    console.warn("[ProgramSelection] AWS hydrate 실패:", err);
    return null;
  }
}

