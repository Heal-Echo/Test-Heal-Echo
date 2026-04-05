"use client";

import Image from "next/image";
import styles from "./home.module.css";
import { getProgramName } from "@/config/programs";

interface WellnessSectionProps {
  isHighlightWellness: boolean;
  onAutobalanceClick: () => void;
  onShowComingSoon: () => void;
}

export default function WellnessSection({
  isHighlightWellness,
  onAutobalanceClick,
  onShowComingSoon,
}: WellnessSectionProps) {
  return (
    <section className={styles.section} id="wellnessSection">
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionTitleAccent} />
        웰니스 솔루션
      </h2>

      <div className={styles.wellnessGrid}>
        <div
          className={`${styles.wellnessCard} ${
            isHighlightWellness ? styles.wellnessHighlight : ""
          }`}
          onClick={onAutobalanceClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAutobalanceClick();
          }}
        >
          <div className={styles.wellnessImageWrap}>
            <Image
              src="/assets/images/webp/balance_reset_square.webp"
              alt={getProgramName("autobalance")}
              width={480}
              height={480}
              sizes="(max-width: 480px) 45vw, (max-width: 1024px) 40vw, 340px"
              priority
              className={styles.wellnessImage}
            />
            <div className={styles.wellnessOverlay}>
              <p className={styles.wellnessSubText}>
                전 세계 82만 명이
                <br />
                아무도 모르게 앓고 있는 불균형
              </p>
              <span className={styles.wellnessAlert}>혹시 나도?</span>
            </div>
          </div>
          <p className={styles.wellnessText}>{getProgramName("autobalance")}</p>
        </div>

        <div
          className={`${styles.wellnessCard} ${
            isHighlightWellness ? styles.wellnessHighlight : ""
          }`}
          onClick={onShowComingSoon}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") onShowComingSoon();
          }}
        >
          <div className={styles.wellnessImageWrap}>
            <Image
              src="/assets/images/webp/woman_condition_square.webp"
              alt={getProgramName("womans-whisper")}
              width={480}
              height={480}
              sizes="(max-width: 480px) 45vw, (max-width: 1024px) 40vw, 340px"
              priority
              className={styles.wellnessImage}
            />
            <div className={styles.wellnessOverlay}>
              <p className={styles.wellnessSubText}>당신의 자궁은 안녕한가요?</p>
            </div>
          </div>
          <p className={styles.wellnessText}>{getProgramName("womans-whisper")}</p>
        </div>
      </div>
    </section>
  );
}
