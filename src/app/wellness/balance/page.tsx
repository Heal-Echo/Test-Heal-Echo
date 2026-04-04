"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./balance.module.css";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";

import { isUserLoggedIn } from "@/auth/user";
import { getProgramName, PROGRAM_ID } from "@/config/programs";
import * as storage from "@/lib/storage";

/**
 * 반응형 이미지 sizes 속성 (5단계 브레이크포인트)
 * - 360px 이하 (초소형 모바일): 화면 전체 너비
 * - 480px 이하 (스마트폰): 화면 전체 너비
 * - 640px 이하 (대형 모바일): 화면의 95% 너비
 * - 1024px 이하 (태블릿): 카드 2열 → 화면의 46% 너비
 * - 그 이상 (데스크탑): 최대 720px 너비
 */
const CARD_IMAGE_SIZES =
  "(max-width: 480px) 100vw, (max-width: 640px) 95vw, (max-width: 1024px) 46vw, 720px";

export default function BalancePage() {
  const router = useRouter();

  // 🔐 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // balance 허브 방문 기록 (BottomTab 요가 라우팅용 — 세션 단위)
  useEffect(() => {
    storage.setSession("balance_hub_visited", "true");
  }, []);

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        <h1 className={styles.title}>
          {getProgramName(PROGRAM_ID.AUTOBALANCE)}
        </h1>

        {/* ── 웰니스 솔루션 구분자 ── */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerLabel}>맞춤 웰니스 3세트</span>
          <span className={styles.dividerLine} />
        </div>

        {/* 카드 그리드 (태블릿에서 2열) */}
        <div className={styles.cardGrid}>
          {/* 위클리 솔루션 */}
          <section className={styles.hubSection}>
            <h2 className={styles.hubSectionTitle}>위클리 솔루션</h2>

            <Link href="/wellness/solution" className={styles.wideCard} aria-label="위클리 솔루션 — 하루 15분, 나를 위한 맞춤 요가 클래스">
              <Image
                src="/assets/images/webp/solutions.webp"
                alt="위클리 솔루션"
                width={1536}
                height={1024}
                sizes={CARD_IMAGE_SIZES}
                className={styles.wideImage}
              />
              <div className={styles.wideCardOverlay}>
                <p className={styles.wideCardText}>하루 15분, 나를 위한 맞춤 요가 클래스</p>
              </div>
            </Link>
          </section>

          {/* 위클리 해빗 */}
          <section className={styles.hubSection}>
            <h2 className={styles.hubSectionTitle}>위클리 해빗</h2>

            <Link href="/wellness/weekly-habit" className={styles.wideCard} aria-label="위클리 해빗 — 쉽게 실천 가능한 수면 습관과 식습관">
              <Image
                src="/assets/images/webp/healing_recipe_square.webp"
                alt="위클리 해빗"
                width={1536}
                height={1024}
                sizes={CARD_IMAGE_SIZES}
                className={styles.wideImage}
              />
              <div className={styles.wideCardOverlay}>
                <p className={styles.wideCardText}>쉽게 실천 가능한 수면 습관과 식습관</p>
              </div>
            </Link>
          </section>

          {/* 이해의 바다 */}
          <section className={`${styles.hubSection} ${styles.hubSectionFull}`}>
            <h2 className={styles.hubSectionTitle}>이해의 바다</h2>

            <Link href="/understanding" className={styles.wideCard} aria-label="이해의 바다 — 조건없이 나를 이해하는 시간">
              <Image
                src="/assets/images/webp/Ocean_of_Understanding_crop1.webp"
                alt="이해의 바다"
                width={1536}
                height={1024}
                sizes={CARD_IMAGE_SIZES}
                className={styles.wideImage}
              />
              <div className={styles.wideCardOverlay}>
                <p className={styles.wideCardText}>조건없이 나를 이해하는 시간</p>
              </div>
            </Link>
          </section>
        </div>
      </main>

      <div className={styles.tabPadding}></div>
      <BottomTab />
    </div>
  );
}
