"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";
import type { ProgramInfo } from "@/config/programs";

interface MySolutionSectionProps {
  isSubLoaded: boolean;
  subscribedProgram: {
    id: string;
    name: string;
    image: string;
    href: string | null;
  } | null;
  confirmedProgram: ProgramInfo | null;
  isAccordionOpen: boolean;
  onShowComingSoon: () => void;
  onOpenModal: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onTrialStart: () => void;
}

export default function MySolutionSection({
  isSubLoaded,
  subscribedProgram,
  confirmedProgram,
  isAccordionOpen,
  onShowComingSoon,
  onOpenModal,
  onTrialStart,
}: MySolutionSectionProps) {
  const router = useRouter();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionTitleAccent} />
        마이 솔루션
      </h2>

      {!isSubLoaded ? (
        /* ── 로딩 중: 빈 공간 유지 (깜빡임 방지) ── */
        <div className={styles.mySolutionCard} style={{ minHeight: 120, opacity: 0.5 }}>
          <p className={styles.mySolutionDesc}>불러오는 중...</p>
        </div>
      ) : subscribedProgram ? (
        /* ── 결제 완료: 구독 프로그램 카드 ── */
        <div
          className={styles.mySolutionSubscribed}
          onClick={() => {
            if (subscribedProgram.href) {
              router.push(subscribedProgram.href);
            } else {
              onShowComingSoon();
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (subscribedProgram.href) {
                router.push(subscribedProgram.href);
              } else {
                onShowComingSoon();
              }
            }
          }}
        >
          <div className={styles.subscribedImageWrap}>
            <Image
              src={subscribedProgram.image}
              alt={subscribedProgram.name}
              width={120}
              height={120}
              className={styles.subscribedImage}
            />
          </div>
          <div className={styles.subscribedInfo}>
            <p className={styles.subscribedName}>{subscribedProgram.name}</p>
            <span className={styles.subscribedCta}>시작하기 →</span>
          </div>
        </div>
      ) : confirmedProgram ? (
        /* ── 선택 완료 (browser + confirmed): 1주차 무료 체험 중 ── */
        <div
          className={styles.mySolutionConfirmed}
          onClick={() => {
            if (confirmedProgram.route) {
              router.push(confirmedProgram.route);
            } else {
              onShowComingSoon();
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (confirmedProgram.route) {
                router.push(confirmedProgram.route);
              } else {
                onShowComingSoon();
              }
            }
          }}
        >
          <div className={styles.subscribedImageWrap}>
            <Image
              src={confirmedProgram.image}
              alt={confirmedProgram.name}
              width={120}
              height={120}
              className={styles.subscribedImage}
            />
          </div>
          <div className={styles.subscribedInfo}>
            <span className={styles.confirmedBadge}>1주차 무료 체험 중</span>
            <p className={styles.confirmedName}>{confirmedProgram.name}</p>
            <span className={styles.confirmedCta}>시작하기 →</span>
          </div>
        </div>
      ) : (
        /* ── 미선택: 무료 체험 CTA ── */
        <div className={styles.mySolutionCard}>
          <span className={styles.mySolutionBadge}>7일 무료 체험</span>
          <p className={styles.mySolutionDesc}>
            하루 15분, 나에게 맞는 맞춤 웰니스를 시작해 보세요
          </p>

          {/* Why Heal Echo 차별화 요약 */}
          <div className={styles.whySummary}>
            <div className={styles.whySummaryItem}>
              <span className={`${styles.whySummaryIcon} ${styles.whySummaryIconYoga}`}>🧘</span>
              <span className={styles.whySummaryText}>
                <strong>솔루션별 맞춤 요가 클래스</strong>
                <br />
                <span className={styles.whySummarySub}>
                  자율신경 균형을 위한 전문 설계 프로그램
                </span>
              </span>
            </div>
            <div className={styles.whySummaryItem}>
              <span className={`${styles.whySummaryIcon} ${styles.whySummaryIconHabit}`}>🌿</span>
              <span className={styles.whySummaryText}>
                <strong>아유르베다 기반 생활 습관</strong>
                <br />
                <span className={styles.whySummarySub}>수면·식습관을 현대과학과 결합해 리셋</span>
              </span>
            </div>
            <div className={styles.whySummaryItem}>
              <span className={`${styles.whySummaryIcon} ${styles.whySummaryIconReport}`}>📊</span>
              <span className={styles.whySummaryText}>
                <strong>나의 변화 추이 리포트</strong>
                <br />
                <span className={styles.whySummarySub}>정기 자가 체크로 내 변화를 눈으로 확인</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            className={styles.programCtaButton}
            onClick={(e) => {
              if (isAccordionOpen) {
                onTrialStart();
              } else {
                onOpenModal(e);
              }
            }}
          >
            {isAccordionOpen
              ? "기적의 오토 밸런스, 무료 체험 시작하기"
              : "Heal Echo 무료 체험 시작하기"}
            <span className={styles.ctaArrow}>→</span>
          </button>

          <p className={styles.trustNote}>
            <span className={styles.trustCheck}>✓</span>
            7일간 무료 · 자동 결제 없음 · 언제든 해지 가능
          </p>
        </div>
      )}
    </section>
  );
}
