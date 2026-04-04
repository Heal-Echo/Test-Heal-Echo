"use client";

import styles from "./pricing.module.css";

interface PricingCardProps {
  plan: "annual" | "monthly";
  setPlan: (plan: "annual" | "monthly") => void;
  isLoading: boolean;
  errorMessage: string | null;
  onCtaClick: () => void;
}

export default function PricingCard({
  plan,
  setPlan,
  isLoading,
  errorMessage,
  onCtaClick,
}: PricingCardProps) {
  return (
    <div className={styles.mainCard}>
      {/* Features */}
      <div className={styles.featuresSection}>
        <span className={styles.sectionLabel}>맞춤형 웰니스 솔루션</span>
        <ul className={styles.featureList}>
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
        </ul>

        <hr className={styles.sectionDivider} />

        <span className={styles.sectionLabel}>
          프로그램 진행에 따라 제공
        </span>
        <ul className={styles.featureList}>
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
        <div
          className={`${styles.priceOption} ${
            plan === "monthly" ? styles.priceOptionSelected : ""
          }`}
          onClick={() => setPlan("monthly")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPlan("monthly"); }}
          aria-pressed={plan === "monthly"}
        >
          <div className={styles.optionLabel}>월간</div>
          <div>
            <span className={styles.optionPrice}>56,000</span>
            <span className={styles.optionUnit}>원/월</span>
          </div>
          <div className={styles.optionDetail}>매월 자동 결제</div>
          <div className={styles.optionDetailSub}>언제든 해지 가능</div>
        </div>

        <div
          className={`${styles.priceOption} ${
            plan === "annual" ? styles.priceOptionSelected : ""
          }`}
          onClick={() => setPlan("annual")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPlan("annual"); }}
          aria-pressed={plan === "annual"}
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
          onClick={onCtaClick}
          disabled={isLoading}
        >
          {isLoading
            ? "처리 중..."
            : plan === "annual"
              ? "연간 플랜 시작하기"
              : "월간 플랜 시작하기"}
        </button>
        {errorMessage && (
          <p
            role="alert"
            style={{ color: "#ef4444", fontSize: 13, marginTop: 8, textAlign: "center" }}
          >
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
