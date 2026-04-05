"use client";

import React, { useRef, useState, useCallback } from "react";
import Image from "next/image";
import styles from "./effect-carousel.module.css";

const slides = [
  {
    img: "/assets/images/tension_after.png",
    alt: "긴장 완화",
    title: "긴장 완화 & 스트레스 완충",
    kpi: "스트레스 지수 ↓ 69%",
    desc: "피로했던 몸과 마음을 이완하고 호흡을 편안하게.",
  },
  {
    img: "/assets/images/sleep_after.png",
    alt: "수면 개선",
    title: "깊고 안정적인 수면",
    kpi: "PSQI(수면의 질) ↑ 평균 65%",
    desc: "밤새 여러 번 깨던 패턴에서 벗어나 숙면을 돕습니다.",
  },
  {
    img: "/assets/images/frog_after.png",
    alt: "맑은 집중력",
    title: "맑은 집중력",
    kpi: "주의·속도 ↑ 18.72%",
    desc: "브레인 포그를 줄이고 선명도를 높입니다.",
  },
  {
    img: "/assets/images/gastric_after.png",
    alt: "가벼운 소화",
    title: "가벼운 소화",
    kpi: "소화불량 ↓ 37.03%",
    desc: "더부룩함을 줄여 편안한 소화를 돕습니다.",
  },
];

export default function EffectCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastSlideRef = useRef(0);

  // 스크롤 감지 — 웰니스 3세트와 동일 로직
  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 1;
    const gap = 10;
    const index = Math.min(Math.round(scrollLeft / (cardWidth + gap)), slides.length - 1);
    if (index !== lastSlideRef.current) {
      lastSlideRef.current = index;
      setActiveIndex(index);
    }
  }, []);

  const scrollToSlide = (index: number) => {
    const el = trackRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = (el.firstElementChild as HTMLElement).offsetWidth;
    const gap = 10;
    el.scrollTo({ left: index * (cardWidth + gap), behavior: "smooth" });
  };

  // 마우스 드래그 스크롤 (데스크톱) — 웰니스 3세트와 동일
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = trackRef.current;
    if (!el) return;
    isDragging.current = true;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragScrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.scrollSnapType = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const el = trackRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    el.scrollLeft = dragScrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = trackRef.current;
    if (!el) return;
    el.style.cursor = "grab";
    setTimeout(() => {
      el.style.scrollSnapType = "x mandatory";
    }, 50);
  }, []);

  return (
    <div className={styles.effectSection}>
      <div className={styles.effectHeader}>
        <h3 className={styles.effectHeaderTitle}>지금, 당신의 변화가 시작됩니다</h3>
        <p className={styles.effectHeaderDesc}>핵심 효과를 슬라이드로 확인하세요</p>
      </div>

      <div
        className={styles.carousel}
        ref={trackRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {slides.map((s, i) => (
          <div key={i} className={styles.card} draggable={false}>
            <div className={styles.cardImageWrap}>
              <Image
                src={s.img}
                alt={s.alt}
                width={320}
                height={320}
                sizes="(max-width: 480px) 40vw, (max-width: 768px) 38vw, 280px"
                className={styles.cardImage}
              />
              <div className={styles.cardOverlay}>
                <span className={styles.cardKpi}>{s.kpi}</span>
                <p className={styles.cardDesc}>{s.desc}</p>
              </div>
            </div>
            <p className={styles.cardLabel}>{s.title}</p>
          </div>
        ))}
      </div>

      <div className={styles.dots}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
            onClick={() => scrollToSlide(i)}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>

      <p className={styles.disclaimer}>
        ※ 본 설명은 유사 연구의 결과이며 개인별 경험은 달라질 수 있습니다.
      </p>
    </div>
  );
}
