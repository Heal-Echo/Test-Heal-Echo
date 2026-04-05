"use client";

import styles from "./floating-trial-cta.module.css";

interface FloatingTrialCtaProps {
  visible: boolean;
  onStart: () => void;
}

export default function FloatingTrialCta({ visible, onStart }: FloatingTrialCtaProps) {
  return (
    <div className={`${styles.wrap} ${visible ? styles.visible : ""}`}>
      <button className={styles.button} onClick={onStart}>
        기적의 오토 밸런스, 무료 체험 시작하기
        <span className={styles.arrow}>→</span>
      </button>
    </div>
  );
}
