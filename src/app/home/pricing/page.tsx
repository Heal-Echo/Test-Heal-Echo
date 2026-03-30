"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./pricing.module.css";
import { isUserLoggedIn, getValidUserInfo } from "@/auth/user";
import { saveSubscription } from "@/auth/subscription";
import type { UserSubscription } from "@/types/subscription";
import { PROGRAMS_LIST } from "@/config/programs";
import { setSession } from "@/lib/storage";
import { syncProgramSelection } from "@/lib/programSelection";

export default function HomePricingPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");
  const [loading, setLoading] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);

  // 보호 페이지: 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      setSession("redirect_after_login", "/home/pricing");
      router.replace("/public/login");
    }
  }, [router]);

  /** CTA 버튼 클릭 → 프로그램 선택 팝업 열기 */
  function handleCtaClick() {
    setShowProgramModal(true);
  }

  /** 프로그램 선택 → AWS 저장 → 빌링 카드 등록 */
  async function handleSelectProgram(programId: string) {
    try {
      setShowProgramModal(false);
      setLoading(true);

      // ★ 토큰 갱신 보장 — 만료 시 Cognito SDK로 자동 갱신
      const validInfo = await getValidUserInfo();
      if (!validInfo) {
        setSession("redirect_after_login", "/home/pricing");
        router.push("/public/login");
        return;
      }

      // ★ AWS에 구독 정보 저장 (browser_selected 상태로)
      // 카드 등록 성공 시 issue-key API에서 free_trial로 전환됨
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
      // localStorage를 사용하지 않아 향후 앱 연동에 문제 없음
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
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
      );
      const payment = tossPayments.payment({ customerKey });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${callbackBase}?${successParams.toString()}`,
        failUrl: `${callbackBase}?${failParams.toString()}`,
        customerEmail: validInfo.email || undefined,
      });
    } catch (err) {
      console.error("[HomePricing] Toss SDK error:", err);
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* home 공통 헤더 */}
      <Header />

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
              onClick={handleCtaClick}
              disabled={loading}
            >
              {loading
                ? "처리 중..."
                : plan === "annual"
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

      <div style={{ height: 80 }} />
      <BottomTab />

      {/* ── 프로그램 선택 팝업 ── */}
      {showProgramModal && (
        <div
          className={styles.programModalOverlay}
          onClick={() => setShowProgramModal(false)}
        >
          <div
            className={styles.programModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.programModalBadge}>7일 무료 체험</span>
            <p className={styles.programModalTitle}>
              나에게 맞는 웰니스를 선택하세요
            </p>
            <p className={styles.programModalSub}>
              선택 즉시 카드 등록 화면으로 이동합니다
            </p>

            <div className={styles.programModalCards}>
              {PROGRAMS_LIST.map((prog) => (
                <button
                  key={prog.id}
                  className={styles.programModalCard}
                  onClick={() => handleSelectProgram(prog.id)}
                >
                  <div className={styles.programModalImageWrap}>
                    <Image
                      src={prog.image}
                      alt={prog.name}
                      width={320}
                      height={320}
                      className={styles.programModalImage}
                    />
                  </div>
                  <span className={styles.programModalCardName}>
                    {prog.name}
                  </span>
                  <span className={styles.programModalCardDesc}>
                    {prog.description}
                  </span>
                  <span className={styles.programModalCardCta}>
                    선택하기 →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
