import shared from "../shared.module.css";
import styles from "./evidence-section.module.css";

export default function EvidenceSection() {
  return (
    <section className={styles.evidenceSection}>
      <div className={shared.container}>
        <h2 className={styles.evidenceTitle}>
          힐에코의 맞춤 웰니스 3세트,
          <br />
          과학이 증명합니다
        </h2>

        <div className={styles.evidenceList}>
          {/* 1. 69% */}
          <div className={styles.evidenceItem}>
            <span className={styles.evidenceNumber}>69%</span>
            <div className={styles.evidenceBody}>
              <p className={styles.evidenceDesc}>
                주 2~3회 요가 수련자는
                <span className={shared.blockOnMobile}>대조군 대비 69%의 스트레스 지수 감소</span>
              </p>
              <p className={styles.evidenceSource}>
                Frontiers in Psychiatry, 2024 — 13건 RCT, 1,026명 메타분석
              </p>
              <p className={styles.evidenceLink}>
                → 힐에코의 위클리 솔루션은 주 3회,
                <span className={shared.blockOnMobile}>
                  하루 15분 맞춤 요가 클래스를 제공합니다
                </span>
              </p>
            </div>
          </div>

          {/* 2. 43% */}
          <div className={styles.evidenceItem}>
            <span className={styles.evidenceNumber}>43%</span>
            <div className={styles.evidenceBody}>
              <p className={styles.evidenceDesc}>
                수면 습관 교육만으로 8주 만에 수면의 질 점수 43% 개선
              </p>
              <p className={styles.evidenceSource}>TPM, 2025 — RCT, 140명, 8주간</p>
              <p className={styles.evidenceLink}>
                → 힐에코의 위클리 해빗은 매주 실천 가능한 수면·식습관을 설계합니다
              </p>
            </div>
          </div>

          {/* 3. 56건 */}
          <div className={styles.evidenceItem}>
            <span className={styles.evidenceNumber}>
              56<span className={styles.evidenceNumberUnit}>건</span>
            </span>
            <div className={styles.evidenceBody}>
              <p className={styles.evidenceDesc}>
                자기 이해 훈련 — 스트레스·불안 감소 효과 &#39;중간 이상&#39; 확인
              </p>
              <p className={styles.evidenceSource}>Mindfulness, 2023 — 56건 RCT 메타분석</p>
              <p className={styles.evidenceLink}>
                → 힐에코의 이해의 바다는 조건 없이 나를 이해하는 시간을 만듭니다
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
