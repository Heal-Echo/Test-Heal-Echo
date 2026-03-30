// src/types/billing.ts
// =======================================================
// 결제 관련 타입 정의
// =======================================================

/** 결제 플랜 유형 */
export type PlanType = "monthly" | "annual";

/** 빌링키 레코드 (PaymentsTable, SK = "billing_{programId}") */
export type BillingRecord = {
  userId: string;
  paymentId: string;           // "billing_{programId}"
  billingKey: string;          // 토스 발급 빌링키
  customerKey: string;         // 고객 고유키 (userId 기반)
  cardLast4: string;           // 카드 마지막 4자리
  cardCompany: string;         // 카드사명
  planType: PlanType;
  status: "active" | "cancelled";
  nextChargeDate: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 결제 내역 레코드 (PaymentsTable, SK = "txn_{orderId}") */
export type TransactionRecord = {
  userId: string;
  paymentId: string;           // "txn_{orderId}"
  orderId: string;             // 주문 고유 ID
  paymentKey: string;          // 토스 결제 키
  amount: number;              // 결제 금액
  status: "success" | "failed";
  chargedAt: string;
};

/** 빌링키 발급 요청 (프론트엔드 → issue-key API) */
export type IssueKeyRequest = {
  authKey: string;
  customerKey: string;
  programId: string;
  planType: PlanType;
};

/** 빌링키 발급 응답 (issue-key API → 프론트엔드) */
export type IssueKeyResponse = {
  ok: boolean;
  billingKey?: string;
  cardLast4?: string;
  cardCompany?: string;
  subscription?: {
    subscriptionType: string;
    startDate: string;
    trialEndDate: string;
  };
  error?: string;
};

/**
 * 빌링키 기반 결제 승인 요청 (스케줄러/Lambda → confirm-payment API)
 * 무료 체험 종료 후 또는 정기 과금 시 사용
 */
export type BillingChargeRequest = {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  programId: string;
  planType: PlanType;
};

/** 빌링키 기반 결제 승인 응답 */
export type BillingChargeResponse = {
  ok: boolean;
  payment?: {
    paymentKey: string;
    orderId: string;
    status: string;
    totalAmount: number;
    method: string;
    approvedAt: string;
  };
  error?: string;
  code?: string;
};

/** 구독 해지 요청 */
export type CancelRequest = {
  programId: string;
};

/** 플랜별 가격 (원) */
export const PLAN_PRICES: Record<PlanType, number> = {
  monthly: 56000,
  annual: 432000,
};

/** 플랜별 주문명 */
export const PLAN_ORDER_NAMES: Record<PlanType, string> = {
  monthly: "힐에코 웰니스 솔루션 (월간)",
  annual: "힐에코 웰니스 솔루션 (연간)",
};
