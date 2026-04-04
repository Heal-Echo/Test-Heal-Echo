"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getValidUserInfo } from "@/auth/user";
import { saveSubscription } from "@/auth/subscription";
import type { UserSubscription } from "@/types/subscription";
import { PROGRAMS_LIST } from "@/config/programs";
import { TOSS_CLIENT_KEY } from "@/config/constants";
import { setSession } from "@/lib/storage";
import { syncProgramSelection } from "@/lib/programSelection";

export function usePricingBilling(plan: "annual" | "monthly") {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isShowProgramModal, setIsShowProgramModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** CTA 버튼 클릭 → 프로그램 선택 팝업 열기 */
  function handleCtaClick() {
    setErrorMessage(null);
    setIsShowProgramModal(true);
  }

  /** 프로그램 선택 → AWS 저장 → 빌링 카드 등록 */
  async function handleSelectProgram(programId: string) {
    try {
      setIsShowProgramModal(false);
      setIsLoading(true);

      // ★ 토큰 갱신 보장 — 만료 시 Cognito SDK로 자동 갱신
      const validInfo = await getValidUserInfo();
      if (!validInfo) {
        setSession("redirect_after_login", "/home/pricing");
        router.push("/public/login");
        return;
      }

      // ★ AWS에 구독 정보 저장 (browser_selected 상태로)
      const subscriptionData: UserSubscription = {
        userId: validInfo.email || "",
        programId,
        subscriptionType: "browser_selected",
        startDate: null,
        currentWeek: 1,
        status: "active",
        pausedAt: null,
        trialEndDate: null,
      };

      await saveSubscription(subscriptionData);

      // 솔루션 선택 동기화 (weekly_habit 키 + AWS preferences 저장)
      syncProgramSelection(programId);

      // customerKey 생성 (토스 빌링에서 고객 식별에 사용)
      const email = validInfo.email || "guest";
      const customerKey = email
        .replace(/[^a-zA-Z0-9@._-]/g, "")
        .slice(0, 50);

      // ★ successUrl에 programId, planType을 쿼리 파라미터로 전달
      const callbackBase = `${window.location.origin}/public/billing/callback`;
      const successParams = new URLSearchParams({
        programId,
        planType: plan,
      });
      const failParams = new URLSearchParams({
        status: "fail",
        programId,
        planType: plan,
      });

      const selectedProgram = PROGRAMS_LIST.find((p) => p.id === programId);
      const programName = selectedProgram?.name || "힐에코 웰니스 솔루션";

      // ★ 토스 페이먼츠 SDK — 빌링(자동결제) 카드 등록
      const { loadTossPayments } = await import(
        "@tosspayments/tosspayments-sdk"
      );
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${callbackBase}?${successParams.toString()}`,
        failUrl: `${callbackBase}?${failParams.toString()}`,
        customerEmail: validInfo.email || undefined,
      });
    } catch (err) {
      console.error("[HomePricing] Toss SDK error:", err);
      setErrorMessage("결제 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setIsLoading(false);
    }
  }

  return {
    isLoading,
    isShowProgramModal,
    setIsShowProgramModal,
    errorMessage,
    handleCtaClick,
    handleSelectProgram,
  };
}
