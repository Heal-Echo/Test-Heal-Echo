"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./hero-programs.module.css";
import { getProgramName } from "@/config/programs";
import { ROUTES } from "@/config/routes";

// Coming Soon 모달: 사용자가 클릭할 때만 필요하므로 지연 로딩
const ComingSoonModal = dynamic(() => import("@/components/publicSite/coming-soon-modal"), {
  ssr: false,
});

export default function HeroProgramsClient() {
  // ▶ 새 진입(navigate)일 때만 최상단 스크롤 — 뒤로가기(back/forward)는 브라우저 복원 유지
  useEffect(() => {
    const navType = performance?.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!navType || navType.type === "navigate") {
      window.scrollTo(0, 0);
    }
  }, []);

  // ▶ 프로그램 카드 하이라이트 상태
  const [isHighlighted, setIsHighlighted] = useState(false);

  // ▶ Coming Soon 모달 상태
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);

  // ▶ 웰니스 솔루션 보기 → 스크롤 + 하이라이트
  const handleScrollToPrograms = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    setIsHighlighted(true);
    setTimeout(() => {
      setIsHighlighted(false);
    }, 2000);

    if (typeof document !== "undefined") {
      const target = document.getElementById("programs");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <>
      {/* ===========================
          Hero
      ============================ */}
      <section className={styles.hero}>
        <div className={shared.container}>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.eyebrow}>Body &amp; Mind &amp; Soul</p>
              <h1 className={styles.heroTitle}>
                하루 15분, 당신을 위한
                <br />
                <span className={styles.heroAccent}>&#39;맞춤 웰니스 솔루션&#39;</span>
              </h1>
              <p className={styles.heroDesc}>
                그냥 요가가 아닙니다.
                <span className={shared.blockOnMobile}>
                  당신의 삶에 맞춘 &#39;맞춤 웰니스 솔루션&#39;입니다.
                </span>
              </p>

              <div className={styles.heroCta}>
                <Link className={`${shared.btnPrimary} ${styles.heroCtaBtn}`} href={ROUTES.LOGIN}>
                  Heal Echo 7일 무료 체험
                </Link>
                <a
                  className={styles.btnPinkOutline}
                  href="#programs"
                  onClick={handleScrollToPrograms}
                >
                  웰니스 솔루션 보기
                </a>
              </div>
            </div>

            <div>
              <Image
                src="/assets/images/webp/wellness.webp"
                alt="웰니스 히어로 이미지"
                width={1200}
                height={720}
                sizes="(max-width: 480px) 100vw, (max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
                priority
                className={styles.heroImg}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          Programs
      ============================ */}
      <section id="programs" className={styles.programs}>
        <div className={shared.container}>
          <div className={styles.programsHead}>
            <h2 className={shared.sectionTitle}>
              회복의 리듬을 되찾는 최고의
              <br />
              <span className={styles.programTitleAccent}>&#39;맞춤 웰니스 솔루션&#39;</span>
            </h2>
            <p className={styles.programSub}>힐에코가 함께 합니다!</p>
          </div>

          <div className={styles.programList}>
            {/* 1. 기적의 오토 밸런스 */}
            <Link href={ROUTES.MIRACLE_RESET} className={styles.programCardLink}>
              <div
                className={`${styles.programCard} ${isHighlighted ? styles.programHighlight : ""}`}
              >
                <div className={styles.programImage}>
                  <Image
                    src="/assets/images/webp/balance_reset.webp"
                    alt={getProgramName("autobalance")}
                    width={533}
                    height={800}
                    sizes="(max-width: 480px) 48vw, (max-width: 640px) 48vw, (max-width: 1024px) 45vw, 400px"
                  />
                  <div className={styles.programOverlay}>
                    <p className={styles.programOverlayDesc}>
                      전 세계 82만 명이 아무도 모르게
                      <br />
                      앓고 있는 불균형
                    </p>
                    <span className={styles.programOverlayBadge}>혹시 나도?</span>
                  </div>
                </div>
              </div>
              <p className={styles.programCardLabel}>{getProgramName("autobalance")}</p>
            </Link>

            {/* 2. 우먼즈 컨디션 케어 */}
            <button
              type="button"
              className={styles.programCardButton}
              onClick={() => setIsComingSoonOpen(true)}
              aria-label={`${getProgramName("womans-whisper")} — Coming Soon`}
            >
              <div
                className={`${styles.programCard} ${isHighlighted ? styles.programHighlight : ""}`}
              >
                <div className={styles.programImage}>
                  <Image
                    src="/assets/images/webp/woman_condition.webp"
                    alt={getProgramName("womans-whisper")}
                    width={533}
                    height={800}
                    sizes="(max-width: 480px) 48vw, (max-width: 640px) 48vw, (max-width: 1024px) 45vw, 400px"
                  />
                  <div className={styles.programOverlay}>
                    <p className={styles.programOverlayDesc}>당신의 자궁은 안녕한가요?</p>
                  </div>
                </div>
              </div>
              <p className={styles.programCardLabel}>{getProgramName("womans-whisper")}</p>
            </button>
          </div>

          <div className={styles.programCta}>
            <Link href={ROUTES.LOGIN} className={styles.btnPink}>
              Heal Echo 7일 무료 체험
            </Link>
          </div>
        </div>
      </section>

      {/* Coming Soon 모달 */}
      <ComingSoonModal open={isComingSoonOpen} onClose={() => setIsComingSoonOpen(false)} />
    </>
  );
}
