// src/types/balance.ts
// =======================================================
// Balance(요가 영상) 도메인 공유 타입 정의
// =======================================================

/**
 * 주차별 영상 기본 정보
 * - weekNumber 는 1, 2, 3 ... 처럼 오름차순으로 넣어주세요.
 */
export type WeeklyVideoConfig = {
  weekNumber: number;
  videoId: string;
};

/**
 * 사용자의 시청 이벤트(플레이 기록)
 * - playedAt 은 ISO 문자열 (예: "2025-01-01T09:00:00.000Z")
 */
export type PlayEvent = {
  videoId: string;
  playedAt: string; // ISO 8601
  eventType?: "impression" | "play" | "pause" | "ended" | "progress";
};

/**
 * 한 주차(영상)에 대한 계산 결과
 */
export type WeekComputedState = {
  weekNumber: number;
  videoId: string;
  openAt: string | null;
  nextWeekOpenAt: string | null;
  lockAt: string | null;
  isOpenToday: boolean;
  isLockedToday: boolean;
  isVisibleToday: boolean;
  role: "past" | "current" | "next" | "futureLocked";
  playsTotal: number;
  playsWithinFirst7Days: number;
  isRequirementMetWithin7Days: boolean;
};

/**
 * 전체 Balance 상태 계산 결과
 */
export type BalanceState = {
  today: string;
  currentWeekNumber: number | null;
  weeks: WeekComputedState[];
};

// ─── Player 전용 타입 ───

/**
 * Balance 공개 API 응답의 개별 항목 (raw)
 */
export type BalanceListItem = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Balance Player에서 사용할 정규화된 영상 데이터
 */
export type BalanceVideo = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
};
