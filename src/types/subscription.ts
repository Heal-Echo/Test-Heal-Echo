// src/types/subscription.ts
// =======================================================
// 고객 구독 상태 관련 타입 정의
// =======================================================

/** 고객 유형 (6가지) */
export type SubscriptionType =
  | "browser" // 둘러보기 (프로그램 미선택)
  | "browser_selected" // 둘러보기 (프로그램 선택)
  | "free_trial" // 무료 체험 (7일 무료 체험, 카드 등록 완료)
  | "paid" // 유료 (유료 전환 후 프로그램 참가 중)
  | "paid_stopped" // 유료 후 중단
  | "free_stopped"; // 무료 체험 후 유료 미전환

/** 구독 상태 */
export type SubscriptionStatus = "active" | "paused" | "expired" | "cancelled";

/** 구독 유형 → 한글 라벨 변환 */
export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = {
  browser: "둘러보기",
  browser_selected: "둘러보기(선택)",
  free_trial: "무료체험",
  paid: "유료",
  paid_stopped: "유료중단",
  free_stopped: "무료미전환",
};

/** 고객 구독 정보 */
export type UserSubscription = {
  userId: string;
  programId: string;
  subscriptionType: SubscriptionType;
  startDate: string | null; // ISO date (프로그램 시작일)
  currentWeek: number; // 현재 주차 (1부터 시작)
  status: SubscriptionStatus;
  pausedAt: string | null; // 일시 정지 시각
  trialEndDate: string | null; // 무료 체험 종료일
};

/** 영상 시청 기록 */
export type WatchRecord = {
  userId: string;
  programId: string;
  weekNumber: number;
  watchDate: string; // YYYY-MM-DD
  watchDurationSeconds: number; // 누적 시청 시간(초)
  isCompleted: boolean; // 10분(600초) 이상 여부
};

/** 선물 사이클 진행도 */
export type GiftCycle = {
  userId: string;
  programId: string;
  cycleNumber: number; // 1, 2, 3... (몇 번째 사이클)
  qualifiedWeeks: number; // 달성 주간 수 (0~4)
  giftUnlockedAt: string | null; // 선물 해금 시각
  giftExpiresAt: string | null; // 선물 만료 시각 (해금 후 7일)
  giftVideoId: string | null; // 해당 사이클의 선물 영상 ID
};

/** Balance 페이지에서 사용하는 통합 고객 상태 */
export type BalanceUserState = {
  subscription: UserSubscription;
  watchRecords: WatchRecord[];
  giftCycle: GiftCycle;
  /** 현재 주차가 선물 해금 주차인지 */
  isGiftWeek: boolean;
  /** 오늘까지 이번 프로그램 주차에서 시청한 일수 */
  daysWatchedThisWeek: number;
  /** 롤링 윈도우 기반 선물 달성 주수 (누적, 리셋 없음) */
  qualifiedWeeksRolling: number;
  /** 최근 7일 중 시청 완료 일수 */
  daysInRecentWindow: number;
  /** 응원 메시지 (미달성 주에 표시) */
  encouragementMessage: string | null;
};
