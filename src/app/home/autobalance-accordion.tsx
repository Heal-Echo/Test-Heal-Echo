"use client";

import React, { useRef, useEffect } from "react";
import WellnessCarousel from "./wellness-carousel";
import EffectCarousel from "./effect-carousel";
import homeStyles from "./home.module.css";
import styles from "./autobalance-accordion.module.css";

const symptoms = [
  "오랜 시간 스트레스에 노출",
  "늘 긴장된 몸과 마음",
  "두통, 위장 장애, 턱 통증, 어깨 결림",
  "병원 검사로 이유가 잘 안 잡히는 불편",
  "\u2018쉼\u2019이 어려움, 습관성 긴장",
  "갑자기 숨이 막히거나, 깊게 숨 쉬고 싶음",
  "머리에 안개 낀 듯한 느낌",
  "잠들기 어려움, 수면 중 잦은 각성",
  "작은 소리나 촉감에 민감하게 반응",
  "하루 6시간 이상 앉아 있는 생활 습관",
];

interface AutobalanceAccordionProps {
  isOpen: boolean;
  onTrialStart: () => void;
  onRequestTrial: (destination: string) => void;
}

export default function AutobalanceAccordion({
  isOpen,
  onTrialStart,
  onRequestTrial,
}: AutobalanceAccordionProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [isOpen]);

  return (
    <div
      ref={panelRef}
      className={`${styles.accordionPanel} ${isOpen ? styles.accordionPanelOpen : ""}`}
    >
      <div className={styles.accordionInner}>
        {/* 증상 카드 */}
        <div className={styles.problemCard}>
          <div className={styles.problemHeader}>
            <p className={styles.problemSubtitle}>전 세계 82만 명이 아무도 모르게 앓고 있는</p>
            <h3 className={styles.problemTitle}>자율신경 불균형</h3>
          </div>

          <ul className={styles.symptomList}>
            {symptoms.map((text, i) => (
              <li key={i} className={styles.symptomItem}>
                <span className={styles.symptomCheck}>✓</span>
                {text}
              </li>
            ))}
          </ul>

          <div
            className={styles.problemNote}
            onClick={onTrialStart}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onTrialStart();
            }}
          >
            위 항목 중 하나라도 해당한다면
            <br />
            지금 &lsquo;기적의 오토 밸런스&rsquo;를 시작하세요
          </div>
        </div>

        {/* 맞춤 웰니스 3세트 */}
        <div className={homeStyles.divider}>
          <span className={homeStyles.dividerLine} />
          <span className={homeStyles.dividerLabel}>맞춤 웰니스 3세트</span>
          <span className={homeStyles.dividerLine} />
        </div>
        <WellnessCarousel onCardClick={onRequestTrial} />

        {/* 효과 캐러셀 */}
        <EffectCarousel />
      </div>
    </div>
  );
}
