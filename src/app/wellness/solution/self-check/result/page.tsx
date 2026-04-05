// src/app/wellness/solution/self-check/result/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./selfcheckResult.module.css";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import { isUserLoggedIn } from "@/auth/user";
import {
  getSavedSelfCheckResult,
  fetchAndHydrateSelfCheckResult,
  getSignalIntensity,
  getSignalGrade,
} from "@/components/self-check/self-check-survey";
import type { SelfCheckResult } from "@/components/self-check/self-check-survey";

export default function SelfCheckResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [checked, setChecked] = useState(false);

  // 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 결과 로드: AWS 우선 조회 → localStorage 폴백 (Home 패턴)
  useEffect(() => {
    async function loadResult() {
      try {
        // AWS 우선 hydrate (key migration 포함)
        const hydrated = await fetchAndHydrateSelfCheckResult();
        if (hydrated) {
          setResult(hydrated);
        } else {
          // 폴백: localStorage에서 직접 조회
          setResult(getSavedSelfCheckResult());
        }
      } catch (err) {
        console.error("자가 체크 결과 로드 실패:", err);
        setResult(getSavedSelfCheckResult());
      } finally {
        setChecked(true);
      }
    }
    loadResult();
  }, []);

  // 앱 복귀(visibilitychange) + 인터넷 복구(online) 시
  // pending 데이터 재전송 + 최신 결과 갱신 (Home 패턴)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // fetchAndHydrateSelfCheckResult 내부에서 pending retry를 이미 수행하므로
    // retryPendingSelfCheckSync를 별도 호출하지 않음 (중복 POST 방지)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAndHydrateSelfCheckResult().then((r) => {
          if (r) setResult(r);
        });
      }
    };

    const handleOnline = () => {
      fetchAndHydrateSelfCheckResult().then((r) => {
        if (r) setResult(r);
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // 결과 없으면 솔루션 페이지로 리다이렉트
  useEffect(() => {
    if (checked && !result) {
      router.replace("/wellness/solution");
    }
  }, [checked, result, router]);

  if (!checked || !result) {
    return (
      <div className={styles.container}>
        <Header />
        <div className={styles.main}>
          <p className={styles.loadingText}>불러오는 중...</p>
        </div>
        <div className={styles.tabPadding} />
        <BottomTab />
      </div>
    );
  }

  const intensity = getSignalIntensity(result.categories);
  const gradeInfo = getSignalGrade(intensity);
  const affectedCount = result.categories.filter((c) => c.percent > 0).length;

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.main}>
        {/* 뒤로가기 + 타이틀 */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>자가체크 결과</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* 불균형 신호 강도 섹션 */}
        <div className={styles.scoreCard}>
          <h2 className={styles.scoreCardTitle}>불균형 신호 강도</h2>
          <div className={styles.scoreCircle} style={{ borderColor: gradeInfo.color }}>
            <span className={styles.scoreCircleNum} style={{ color: gradeInfo.color }}>
              {intensity}
            </span>
            <span className={styles.scoreCircleUnit} style={{ color: gradeInfo.color }}>
              %
            </span>
          </div>
          <div className={styles.gradeRow}>
            <span className={styles.gradeBadge} style={{ background: gradeInfo.color }}>
              {gradeInfo.grade}
            </span>
            <span className={styles.gradeLabel} style={{ background: gradeInfo.color }}>
              {gradeInfo.shortLabel}
            </span>
          </div>
          <p className={styles.motivation}>
            {intensity === 0 ? (
              "최상의 자율신경 균형을 유지하고 있어요!"
            ) : (
              <>
                {intensity}점만 좋아지면 최상의 균형이에요.
                <br />
                하루 15분 요가로 회복할 수 있어요.
              </>
            )}
          </p>
        </div>

        {/* 영역별 분석 섹션 */}
        <div className={styles.barSection}>
          <h3 className={styles.barTitle}>영역별 분석</h3>
          <div className={styles.barList}>
            {result.categories.map((cat) => (
              <div key={cat.id} className={styles.barRow}>
                <div className={styles.barLeft}>
                  <span className={styles.barIcon}>{cat.icon}</span>
                  <span className={styles.barLabel}>{cat.title}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${cat.percent}%`, background: cat.color }}
                  />
                </div>
                <span className={styles.barValue}>{cat.percent}%</span>
              </div>
            ))}
          </div>
          <p className={styles.barNote}>{affectedCount}개 영역에서 불균형 신호가 감지되었어요.</p>
        </div>

        {/* 당신의 자율신경은 이런 신호를 보내고 있어요 섹션 */}
        <div className={styles.barSection}>
          <p className={styles.iconIntro}>당신의 자율신경은 이런 신호를 보내고 있어요.</p>
          <div className={styles.iconGrid}>
            {result.categories.map((cat) => {
              const tier =
                cat.percent <= 20
                  ? { label: "안정", className: styles.tierStable }
                  : cat.percent <= 50
                    ? { label: "관심 필요", className: styles.tierCaution }
                    : { label: "회복 필요", className: styles.tierRecover };
              return (
                <div key={cat.id} className={styles.iconItem}>
                  <span className={styles.iconEmoji}>{cat.icon}</span>
                  <span className={styles.iconName}>{cat.title}</span>
                  <span className={`${styles.iconStatus} ${tier.className}`}>{tier.label}</span>
                </div>
              );
            })}
          </div>
          <button className={styles.startBtn} onClick={() => router.push("/wellness/solution")}>
            하루 15분 요가, 지금 시작하기
          </button>
        </div>

        {/* 자율신경의 균형은 회복될 수 있어요 */}
        <div className={styles.hopeCard}>
          <div className={styles.hopeEmoji}>🌿</div>
          <p className={styles.hopeText}>
            자율신경의 균형은 회복될 수 있어요.
            <br />
            하루 15분, 꾸준한 실천으로
            <br />
            많은 분들이 변화를 경험하고 있어요.
          </p>
        </div>

        {/* 확인 버튼 */}
        <div className={styles.ctaSection}>
          <button className={styles.closeBtn} onClick={() => router.back()}>
            확인
          </button>
        </div>
      </div>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
