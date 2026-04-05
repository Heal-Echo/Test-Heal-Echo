"use client";

import React, { useRef, useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

const WELLNESS_SLIDES = [
  {
    href: "/wellness/solution",
    image: "/assets/images/webp/solutions_320.webp",
    alt: "위클리 솔루션",
    label: "위클리 솔루션",
    desc: "하루 15분, 나를 위한 맞춤 요가 클래스",
  },
  {
    href: "/wellness/weekly-habit",
    image: "/assets/images/webp/healing_recipe_square_320.webp",
    alt: "위클리 해빗",
    label: "위클리 해빗",
    desc: "쉽게 실천 가능한 수면 습관과 식습관",
  },
  {
    href: "/understanding",
    image: "/assets/images/webp/Ocean_of_Understanding_crop1.webp",
    alt: "이해의 바다",
    label: "이해의 바다",
    desc: "조건없이 나를 이해하는 시간",
  },
];

export default function WellnessCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const lastSlideRef = useRef(0);

  // 카루셀 스크롤 감지 — 슬라이드가 실제 변경될 때만 setState
  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 1;
    const gap = 10;
    const index = Math.min(Math.round(scrollLeft / (cardWidth + gap)), WELLNESS_SLIDES.length - 1);
    if (index !== lastSlideRef.current) {
      lastSlideRef.current = index;
      setActiveSlide(index);
    }
  }, []);

  const scrollToSlide = (index: number) => {
    const el = carouselRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = (el.firstElementChild as HTMLElement).offsetWidth;
    const gap = 10;
    el.scrollTo({ left: index * (cardWidth + gap), behavior: "smooth" });
  };

  // 마우스 드래그 스크롤 (데스크톱)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragMoved = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    isDragging.current = true;
    dragMoved.current = false;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragScrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.scrollSnapType = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const el = carouselRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    if (Math.abs(x - dragStartX.current) > 5) {
      dragMoved.current = true;
    }
    el.scrollLeft = dragScrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = carouselRef.current;
    if (!el) return;
    el.style.cursor = "grab";
    setTimeout(() => {
      el.style.scrollSnapType = "x mandatory";
    }, 50);
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (dragMoved.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return (
    <section className={styles.carouselSection}>
      <div
        className={styles.carouselTrack}
        ref={carouselRef}
        onScroll={handleCarouselScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {WELLNESS_SLIDES.map((slide) => (
          <Link
            key={slide.href}
            href={slide.href}
            className={styles.carouselCard}
            onClick={handleCardClick}
            draggable={false}
          >
            <div className={styles.carouselImageWrap}>
              <Image
                src={slide.image}
                alt={slide.alt}
                width={320}
                height={320}
                sizes="(max-width: 480px) 40vw, (max-width: 768px) 38vw, 280px"
                className={styles.carouselImage}
              />
              <div className={styles.carouselOverlay}>
                <p className={styles.carouselDesc}>{slide.desc}</p>
              </div>
            </div>
            <p className={styles.carouselLabel}>{slide.label}</p>
          </Link>
        ))}
      </div>

      {/* Dot indicator */}
      <div className={styles.carouselDots}>
        {WELLNESS_SLIDES.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${activeSlide === i ? styles.dotActive : ""}`}
            onClick={() => scrollToSlide(i)}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
