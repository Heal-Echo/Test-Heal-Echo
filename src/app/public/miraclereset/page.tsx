"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import PublicHeader from "@/components/publicSite/public-header";
import { getProgramName } from "@/config/programs";
import styles from "./miraclereset.module.css";

/* ── 캐러셀 슬라이드 데이터 ── */
const slides = [
  {
    img: "/assets/images/tension_after.png",
    alt: "스트레스 지수 감소(After)",
    title: "긴장 완화 & 스트레스 완충",
    kpi: "스트레스 지수 ↓ 12.5%",
    desc: "피로했던 몸과 마음을 이완하고 호흡을 편안하게.",
    source:
      "Miyoshi Y. (2019). Restorative yoga for occupational stress among Japanese female nurses working night shift: randomized crossover trial.",
  },
  {
    img: "/assets/images/sleep_after.png",
    alt: "수면의 질 개선(After)",
    title: "깊고 안정적인 수면",
    kpi: "PSQI(수면의 질) ↑ 평균 65%",
    desc: "밤새 여러 번 깨던 패턴에서 벗어나 숙면을 돕습니다.",
    source: "Turmel et al. (2022). Tailored individual yoga practice improves sleep quality.",
  },
  {
    img: "/assets/images/frog_after.png",
    alt: "주의/처리속도 향상(After)",
    title: "맑은 집중력",
    kpi: "주의·속도 ↑ 18.72%",
    desc: "브레인 포그를 줄이고 선명도를 높입니다.",
    source: "Innes KE, et al. J Alzheimers Dis (2017). 12분/일, 12주.",
  },
  {
    img: "/assets/images/gastric_after.png",
    alt: "소화불량 증상 개선(After)",
    title: "가벼운 소화",
    kpi: "소화불량 ↓ 37.03%",
    desc: "더부룩함을 줄여 편안한 소화를 돕습니다.",
    source:
      "Adjuvant yoga therapy for symptom management of functional dyspepsia: A case series. J Family Med Prim Care (2023).",
  },
];

export default function MiracleResetPage() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [openDetail, setOpenDetail] = useState<number | null>(null);

  /* ── 캐러셀 이동 ── */
  const currentIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    const children = Array.from(track.children) as HTMLElement[];
    const x = track.scrollLeft;
    let idx = 0;
    let best = Infinity;
    children.forEach((el, i) => {
      const d = Math.abs(el.offsetLeft - x);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return idx;
  }, []);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    const n = Math.max(0, Math.min(i, children.length - 1));
    track.scrollTo({ left: children[n].offsetLeft, behavior: "smooth" });
  }, []);

  const goPrev = useCallback(() => goTo(currentIndex() - 1), [goTo, currentIndex]);
  const goNext = useCallback(() => goTo(currentIndex() + 1), [goTo, currentIndex]);

  /* 키보드 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext]
  );

  /* 리사이즈 시 위치 보정 */
  useEffect(() => {
    const onResize = () => {
      const i = currentIndex();
      setTimeout(() => {
        const track = trackRef.current;
        if (!track) return;
        const children = Array.from(track.children) as HTMLElement[];
        const n = Math.max(0, Math.min(i, children.length - 1));
        track.scrollTo({ left: children[n].offsetLeft, behavior: "auto" });
      }, 60);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [currentIndex]);

  return (
    <div className={styles.pageWrapper}>
      {/* 공통 헤더 */}
      <PublicHeader />

      <main>
        {/* ── Join Today ── */}
        <section className={styles.joinToday}>
          <div className={styles.container}>
            <p className={styles.joinTodayText}>Join Today</p>
          </div>
        </section>

        {/* ── 진행 솔루션 카드 ── */}
        <section>
          <div className={styles.container} style={{ textAlign: "center" }}>
            <div className={styles.pillTitle}>
              진행 중인 웰니스 솔루션 :{" "}
              <span style={{ color: "#000" }}>{getProgramName("autobalance")}</span>
            </div>
          </div>

          <div className={styles.surfaceCard}>
            <p style={{ textAlign: "center", margin: "0 0 6px" }}>
              전 세계 82만 명이 아무도 모르게 앓고 있는 불균형
            </p>
            <h3 className={styles.cardHighlight}>자율신경 불균형</h3>

            <div className={styles.twoCol}>
              <ul className={styles.list}>
                <li>오랜 시간 스트레스에 노출</li>
                <li>늘 긴장된 몸과 마음</li>
                <li>두통, 위장 장애, 턱 통증, 어깨 결림</li>
                <li>병원 검사로 이유가 잘 안 잡히는 불편</li>
                <li>&lsquo;쉼&rsquo;이 어려움, 습관성 긴장</li>
                <li>갑자기 숨이 막히거나, 깊게 숨 쉬고 싶음</li>
                <li>머리에 안개 낀 듯한 느낌</li>
                <li>잠들기 어려움, 수면 중 잦은 각성</li>
                <li>작은 소리나 촉감에 민감하게 반응</li>
                <li>하루 6시간 이상 앉아 있는 생활 습관</li>
              </ul>

              <Image
                src="/assets/images/before_reset.png"
                alt="Before 상태 예시"
                width={600}
                height={600}
                className={styles.twoColImg}
              />
            </div>

            <p className={styles.note}>
              위 항목 중 하나라도 해당한다면 지금 &lsquo;기적의 오토 밸런스&rsquo;를 시작하세요.
            </p>
          </div>
        </section>

        {/* ── 프로그램 효과 (캐러셀) ── */}
        <section className={styles.effectSection}>
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <h2>지금, 당신의 변화가 시작됩니다</h2>
              <p>핵심 효과를 슬라이드로 확인하세요.</p>
            </div>

            <div className={styles.carousel}>
              <button
                className={`${styles.arrow} ${styles.arrowPrev}`}
                onClick={goPrev}
                aria-label="이전"
              >
                ‹
              </button>

              <div
                className={styles.track}
                ref={trackRef}
                tabIndex={0}
                aria-live="polite"
                aria-roledescription="carousel"
                onKeyDown={handleKeyDown}
              >
                {slides.map((s, i) => (
                  <article key={i} className={styles.slide}>
                    <div className={styles.resultCard}>
                      <div className={styles.resultMedia}>
                        <Image src={s.img} alt={s.alt} width={540} height={304} />
                      </div>
                      <div className={styles.resultBody}>
                        <h3 className={styles.resultTitle}>{s.title}</h3>
                        <span className={styles.kpi}>{s.kpi}</span>
                        <p className={styles.resultDesc}>{s.desc}</p>
                        <div className={styles.detailToggle}>
                          <button
                            className={styles.detailBtn}
                            onClick={() => setOpenDetail(openDetail === i ? null : i)}
                          >
                            {openDetail === i ? "접기" : "자세히 보기"}
                          </button>
                          {openDetail === i && (
                            <p className={styles.source}>
                              근거: <em>{s.source}</em>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <button
                className={`${styles.arrow} ${styles.arrowNext}`}
                onClick={goNext}
                aria-label="다음"
              >
                ›
              </button>
            </div>

            <p className={styles.resultsNote}>
              ※ 본 설명은 유사 연구의 결과이며 개인별 경험은 달라질 수 있습니다.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerContent}`}>
          <p>&copy; 2025 Heal Echo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
