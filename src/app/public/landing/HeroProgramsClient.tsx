"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import styles from "./landing.module.css";
import { getProgramName } from "@/config/programs";
import { ROUTES } from "@/config/routes";

// Coming Soon 모달: 사용자가 클릭할 때만 필요하므로 지연 로딩
const ComingSoonModal = dynamic(
  () => import("@/components/publicSite/ComingSoonModal"),
  { ssr: false }
);

export default function HeroProgramsClient() {
  // ▶ 페이지 진입 시 최상단 보장 (브라우저 스크롤 복원 방지)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ▶ 프로그램 카드 하이라이트 상태
  const [highlightPrograms, setHighlightPrograms] = useState(false);

  // ▶ Coming Soon 모달 상태
  const [showComingSoon, setShowComingSoon] = useState(false);

  // ▶ 웰니스 솔루션 보기 → 스크롤 + 하이라이트
  const handleScrollToPrograms = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    setHighlightPrograms(true);
    setTimeout(() => {
      setHighlightPrograms(false);
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
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.eyebrow}>Body &amp; Mind &amp; Soul</p>
              <h1 className={styles.heroTitle}>
                하루 15분, 당신을 위한
                <br />
                <span className={styles.heroAccent}>
                  &#39;맞춤 웰니스 솔루션&#39;
                </span>
              </h1>
              <p className={styles.heroDesc}>
                그냥 요가가 아닙니다.
                <span className={styles.blockOnMobile}>당신의 삶에 맞춘 &#39;맞춤 웰니스 솔루션&#39;입니다.</span>
              </p>

              <div className={styles.heroCta}>
                <a className={styles.btnPrimary} href={ROUTES.LOGIN}>
                  Heal Echo 7일 무료 체험
                </a>
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
        <div className={styles.container}>
          <div className={styles.programsHead}>
            <h2 className={styles.sectionTitle}>
              회복의 리듬을 되찾는 최고의
              <br />
              <span className={styles.programTitleAccent}>
                &#39;맞춤 웰니스 솔루션&#39;
              </span>
            </h2>
            <p className={styles.programSub}>힐에코가 함께 합니다!</p>
          </div>

          <div className={styles.programList}>
            {/* 1. 기적의 오토 밸런스 */}
            <a href={ROUTES.MIRACLE_RESET} className={styles.programCardLink}>
              <div className={`${styles.programCard} ${highlightPrograms ? styles.programHighlight : ""}`}>
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
                      전 세계 82만 명이 아무도 모르게<br />앓고 있는 불균형
                    </p>
                    <span className={styles.programOverlayBadge}>혹시 나도?</span>
                  </div>
                </div>
              </div>
              <p className={styles.programCardLabel}>{getProgramName("autobalance")}</p>
            </a>

            {/* 2. 우먼즈 컨디션 케어 */}
            <button
              type="button"
              className={styles.programCardButton}
              onClick={() => setShowComingSoon(true)}
              aria-label={`${getProgramName("womans-whisper")} — Coming Soon`}
            >
              <div className={`${styles.programCard} ${highlightPrograms ? styles.programHighlight : ""}`}>
                <div className={styles.programImage}>
                  <Image
                    src="/assets/images/webp/woman_condition.webp"
                    alt={getProgramName("womans-whisper")}
                    width={533}
                    height={800}
                    sizes="(max-width: 480px) 48vw, (max-width: 640px) 48vw, (max-width: 1024px) 45vw, 400px"
                  />
                  <div className={styles.programOverlay}>
                    <p className={styles.programOverlayDesc}>
                      당신의 자궁은 안녕한가요?
                    </p>
                  </div>
                </div>
              </div>
              <p className={styles.programCardLabel}>
                {getProgramName("womans-whisper")}
              </p>
            </button>

          </div>

          <div className={styles.programCta}>
            <a href={ROUTES.LOGIN} className={styles.btnPink}>
              Heal Echo 7일 무료 체험
            </a>
          </div>
        </div>
      </section>

      {/* Coming Soon 모달 */}
      <ComingSoonModal
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
      />
    </>
  );
}
