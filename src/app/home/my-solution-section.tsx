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
  onShowComingSoon: () => void;
  onOpenModal: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function MySolutionSection({
  isSubLoaded,
  subscribedProgram,
  confirmedProgram,
  onShowComingSoon,
  onOpenModal,
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
          <p className={styles.mySolutionDesc}>나에게 맞는 맞춤 웰니스를 시작해 보세요</p>
          <button type="button" className={styles.programCtaButton} onClick={onOpenModal}>
            Heal Echo 무료 체험 시작하기
            <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      )}
    </section>
  );
}
