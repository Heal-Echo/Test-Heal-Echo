"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import styles from "./pricing.module.css";
import { isUserLoggedIn } from "@/auth/user";
import { setSession } from "@/lib/storage";
import PricingCard from "./pricing-card";
import ProgramSelectPopup from "./program-select-popup";
import { usePricingBilling } from "./use-pricing-billing";

export default function HomePricingPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  const {
    isLoading,
    isShowProgramModal,
    setIsShowProgramModal,
    errorMessage,
    handleCtaClick,
    handleSelectProgram,
  } = usePricingBilling(plan);

  // 보호 페이지: 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      setSession("redirect_after_login", "/home/pricing");
      router.replace("/public/login");
    }
  }, [router]);

  return (
    <div className={styles.page}>
      <Header />

      <div className={styles.container}>
        <div className={styles.pricingHeader}>
          <h1 className={styles.pricingTitle}>
            7일간 무료로 경험하고,
            <br />
            <span className={styles.pricingTitleAccent}>결정하세요.</span>
          </h1>
        </div>

        <PricingCard
          plan={plan}
          setPlan={setPlan}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onCtaClick={handleCtaClick}
        />

        <div className={styles.dailyCost}>
          {plan === "annual" ? (
            <p>
              <span className={styles.dailyCostAccent}>하루 1,183원</span>, 연간 플랜으로
              시작하세요.
            </p>
          ) : (
            <p>언제든 해지 가능</p>
          )}
        </div>

        <div className={styles.guarantee}>
          <span className={styles.guaranteeCheck}>&#x2714;</span> 7일 무료 체험 중 언제든 취소 가능
        </div>

        <div className={styles.refundSection}>
          <h3 className={styles.refundTitle}>환불 정책</h3>
          <ul className={styles.refundList}>
            <li className={styles.refundItem}>
              7일 무료 체험 기간 내 취소 시, 비용이 청구되지 않습니다.
            </li>
            <li className={styles.refundItem}>
              월간 플랜은 다음 결제일 전까지 해지하면 추가 과금이 없습니다.
            </li>
            <li className={styles.refundItem}>
              연간 플랜은 결제일로부터 7일 이내 전액 환불이 가능합니다.
            </li>
            <li className={styles.refundItem}>
              환불 요청은 앱 내 설정 또는 고객 지원을 통해 가능합니다.
            </li>
          </ul>
        </div>
      </div>

      <div style={{ height: 80 }} />
      <BottomTab />

      {isShowProgramModal && (
        <ProgramSelectPopup
          onClose={() => setIsShowProgramModal(false)}
          onSelectProgram={handleSelectProgram}
        />
      )}
    </div>
  );
}
