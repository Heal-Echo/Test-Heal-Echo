import Link from "next/link";
import shared from "../shared.module.css";
import styles from "./why-section.module.css";
import { ROUTES } from "@/config/routes";

export default function WhySection() {
  return (
    <section id="why-healecho" className={styles.whySection}>
      <div className={shared.container}>
        <div className={styles.whyHead}>
          <p className={styles.eyebrowPink}>Why Heal Echo</p>
          <h2 className={shared.sectionTitle}>
            당신에게 필요한 것은
            <span className={shared.blockOnMobile}>&#39;맞춤 웰니스 솔루션&#39;입니다.</span>
          </h2>
        </div>

        <div className={styles.whyCard}>
          {/* 상단: 맞춤 웰니스 솔루션 */}
          <div className={styles.whyCardGroup}>
            <h3 className={styles.whyCardGroupTitle}>맞춤 웰니스 솔루션</h3>
            <ul className={styles.whyCardList}>
              <li>솔루션별 맞춤 요가 클래스</li>
              <li>현대과학과 아유르베다 기반, 솔루션별 맞춤 생활 습관 설계</li>
              <li>마음을 위한 명상 세션</li>
            </ul>
          </div>

          <div className={styles.whyCardDivider} />

          {/* 하단: 프로그램 진행에 따라 제공 */}
          <div className={styles.whyCardGroup}>
            <h3 className={styles.whyCardGroupTitle}>프로그램 진행에 따라 제공</h3>
            <ul className={styles.whyCardList}>
              <li>피츠버그 대학의 수면 분석 검사 : 연 12회 제공</li>
              <li>체질별 추천 음식 : 연 1회 제공</li>
              <li>인도 아유르베다 도샤 체크를 통한 변화 분석 : 연 4회 제공</li>
              <li>솔루션별 맞춤 자가 체크 : 연 12회 (예 : 자율신경 자가 체크)</li>
              <li>나의 변화를 알 수 있는 항목별 변화 추이 리포트</li>
            </ul>
          </div>

          {/* CTA */}
          <Link href={ROUTES.LOGIN} className={styles.whyCardCta}>
            지금 시작하기 →
          </Link>
          <Link href={ROUTES.PRICING} className={styles.whyCardPricing}>
            가격 안내 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
