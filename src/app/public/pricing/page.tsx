"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/publicSite/PublicHeader";
import styles from "./pricing.module.css";
import { isUserLoggedIn } from "@/auth/user";
import { setSession } from "@/lib/storage";

export default function PricingPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");

  // public/pricing에서 로그인 시 → /home/pricing으로 리다이렉트되도록 설정
  // PublicHeader의 "로그인" / "무료 체험" 링크를 통한 로그인도 포함
  useEffect(() => {
    setSession("redirect_after_login", "/home/pricing");
  }, []);

  function handleStartTrial() {
    // 이미 로그인된 경우 → home/pricing으로 바로 이동 (결제 시스템 있는 곳)
    if (isUserLoggedIn()) {
      router.push("/home/pricing");
      return;
    }

    // 비로그인 → 로그인 페이지 → 로그인 후 /home/pricing으로 이동
    setSession("redirect_after_login", "/home/pricing");
    router.push("/public/login");
  }

  return (
    <div className={styles.page}>
      <PublicHeader />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.pricingHeader}>
          <h1 className={styles.pricingTitle}>
            7일간 무료로 경험하고,
            <br />
            <span className={styles.pricingTitleAccent}>결정하세요.</span>
          </h1>
        </div>

        {/* Main Card */}
        <div className={styles.mainCard}>
          {/* Features */}
          <div className={styles.featuresSection}>
            <ul className={styles.featureList}>
              <span className={styles.sectionLabel}>맞춤형 웰니스 솔루션</span>

              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>솔루션별 맞춤 요가 클래스</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>현대과학과 아유르베다 기반 생활 습관 설계</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>마음을 위한 명상 세션</span>
              </li>

              <hr className={styles.sectionDivider} />

              <span className={styles.sectionLabel}>
                프로그램 진행에 따라 제공
              </span>

              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>피츠버그 대학의 수면 분석 검사 : 연 12회 제공</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>체질별 추천 음식 : 연 1회 제공</span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>
                  인도 아유르베다 도샤 체크를 통한 변화 분석 : 연 4회 제공
                </span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>
                  솔루션별 맞춤 자가 체크 : 연 12회 (예 : 자율신경 자가 체크)
                </span>
              </li>
              <li className={styles.featureItem}>
                <span className={styles.featureIcon}>&#10003;</span>
                <span>나의 변화를 알 수 있는 항목별 변화 추이 리포트</span>
              </li>
            </ul>
          </div>

          {/* Price Comparison */}
          <div className={styles.priceComparison}>
            {/* Monthly */}
            <div
              className={`${styles.priceOption} ${
                plan === "monthly" ? styles.priceOptionSelected : ""
              }`}
              onClick={() => setPlan("monthly")}
            >
              <div className={styles.optionLabel}>월간</div>
              <div>
                <span className={styles.optionPrice}>56,000</span>
                <span className={styles.optionUnit}>원/월</span>
              </div>
              <div className={styles.optionDetail}>매월 자동 결제</div>
              <div className={styles.optionDetailSub}>언제든 해지 가능</div>
            </div>

            {/* Annual */}
            <div
              className={`${styles.priceOption} ${
                plan === "annual" ? styles.priceOptionSelected : ""
              }`}
              onClick={() => setPlan("annual")}
            >
              <span className={styles.recommendBadge}>추천</span>
              <div className={styles.optionLabel}>연간</div>
              <div className={styles.optionOriginal}>56,000원</div>
              <div>
                <span className={styles.optionPrice}>36,000</span>
                <span className={styles.optionUnit}>원/월</span>
              </div>
              <div className={styles.discountBadge}>런칭 특가 35% 할인</div>
            </div>
          </div>

          {/* CTA */}
          <div className={styles.ctaSection}>
            <button
              className={styles.ctaBtn}
              onClick={handleStartTrial}
            >
              {plan === "annual"
                ? "연간 플랜 시작하기"
                : "월간 플랜 시작하기"}
            </button>
          </div>
        </div>

        {/* Daily Cost */}
        <div className={styles.dailyCost}>
          {plan === "annual" ? (
            <p>
              <span className={styles.dailyCostAccent}>하루 1,183원</span>,
              연간 플랜으로 시작하세요.
            </p>
          ) : (
            <p>언제든 해지 가능</p>
          )}
        </div>

        {/* Guarantee */}
        <div className={styles.guarantee}>
          <span className={styles.guaranteeCheck}>&#x2714;</span> 7일 무료 체험
          중 언제든 취소 가능
        </div>

        {/* Refund Policy */}
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
    </div>
  );
}
