import Image from "next/image";
import shared from "../shared.module.css";
import styles from "./benefit-section.module.css";

export default function BenefitSection() {
  return (
    <section id="member-benefit" className={styles.benefitSection}>
      <div className={shared.container}>
        <div className={styles.benefitHead}>
          <p className={styles.eyebrowPink}>Member&#39;s Benefit</p>
          <h2 className={shared.sectionTitle}>
            <span className={styles.benefitTitleAccent}>힐에코</span>의 &#39;
            <span className={styles.benefitTitleHighlight}>맞춤 웰니스 3세트</span>&#39;
          </h2>
          <p className={styles.benefitSub}>
            힐에코의 웰니스 솔루션은 &#39;맞춤 웰니스 3세트&#39;로 구성됩니다.
          </p>
          <p className={styles.benefitSub}>
            &#39;위클리 솔루션과 위클리 해빗&#39;은 솔루션별로 내용이 상이합니다.
          </p>
        </div>

        <ul className={styles.benefitCards}>
          {/* 1. 위클리 솔루션 */}
          <li className={styles.benefitCardWrap}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitImageWrap}>
                <Image
                  src="/assets/images/webp/solutions.webp"
                  alt="위클리 솔루션"
                  width={800}
                  height={533}
                  sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                  className={styles.benefitImage}
                />
              </div>
              <h3 className={styles.benefitTitle}>위클리 솔루션</h3>
              <p className={styles.benefitDesc}>
                솔루션별 가장 효과적인
                <span className={shared.blockOnMobile}>맞춤 효과 클래스</span>
              </p>
            </div>
          </li>

          {/* 2. 위클리 해빗 */}
          <li className={styles.benefitCardWrap}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitImageWrap}>
                <Image
                  src="/assets/images/webp/healing_recipe_square.webp"
                  alt="위클리 해빗"
                  width={800}
                  height={533}
                  sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                  className={styles.benefitImage}
                />
              </div>
              <h3 className={styles.benefitTitle}>위클리 해빗</h3>
              <p className={styles.benefitDesc}>
                쉽게 실천 가능한
                <span className={shared.blockOnMobile}>수면 습관과 식습관</span>
              </p>
            </div>
          </li>

          {/* 3. 이해의 바다 */}
          <li className={styles.benefitCardWrap}>
            <div className={styles.benefitCard}>
              <div className={styles.benefitImageWrap}>
                <Image
                  src="/assets/images/webp/Ocean_of_Understanding_crop.webp"
                  alt="이해의 바다"
                  width={800}
                  height={533}
                  sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                  className={styles.benefitImage}
                />
              </div>
              <h3 className={styles.benefitTitle}>이해의 바다</h3>
              <p className={styles.benefitDesc}>
                조건없이
                <span className={shared.blockOnMobile}>나를 이해하는 시간</span>
              </p>
            </div>
          </li>
        </ul>

        <div className={styles.benefitNoteBox}>
          <p className={styles.benefitNote}>
            ※ 솔루션들은 <strong>단계별로 차근차근 오픈</strong>되어
            <span className={shared.blockOnMobile}>매우 따라하기 쉽습니다.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
