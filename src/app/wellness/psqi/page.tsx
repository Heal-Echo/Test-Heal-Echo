// src/app/wellness/psqi/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./psqi.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import PSQITest from "@/components/weekly-habit/PSQITest";
import { isUserLoggedIn } from "@/auth/user";
import * as storage from "@/lib/storage";

const PSQI_SKIP_KEY = "psqi_skipped";

function PSQIPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  // 구독 관리 페이지에서 진입한 경우
  const isFromSubscription = from === "subscription";

  const [existingResult, setExistingResult] = useState<{
    total: number;
    components: Record<string, number>;
    efficiency: number;
  } | null>(null);
  const [checked, setChecked] = useState(false);

  // 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // AWS에서 기존 PSQI 결과 확인
  useEffect(() => {
    async function checkExistingPSQI() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/psqi-result", {
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          const results = json.results || json.items || [];
          if (Array.isArray(results) && results.length > 0) {
            const latest = results[results.length - 1];
            setExistingResult({
              total: latest.total,
              components: latest.components || {},
              efficiency: latest.efficiency || 0,
            });
          }
        }
      } catch (err) {
        console.error("PSQI 결과 확인 실패:", err);
      } finally {
        setChecked(true);
      }
    }

    checkExistingPSQI();
  }, []);

  // PSQI 결과 서버 저장
  async function handlePSQISubmit(result: {
    answers: Record<string, string | number>;
    total: number;
    components: Record<string, number>;
    efficiency: number;
  }) {
    try {
      const userToken = storage.getRaw("user_id_token");
      const res = await fetch("/api/user/psqi-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        },
        body: JSON.stringify(result),
      });

      if (!res.ok) {
        console.error("PSQI 결과 저장 실패:", res.status);
      }
    } catch (err) {
      console.error("PSQI 결과 저장 에러:", err);
    }
  }

  // CTA 클릭: 맥락에 따라 분기
  function handleNavigateToHabit() {
    try { storage.remove(PSQI_SKIP_KEY); } catch {}
    if (isFromSubscription) {
      // 구독 관리에서 진입: 구독 관리로 돌아가기
      router.push("/mypage/settings/subscription");
    } else {
      // 기본: 위클리 해빗으로 이동
      router.push("/wellness/weekly-habit");
    }
  }

  // 나중에 하기: 맥락에 따라 분기
  function handleSkip() {
    if (isFromSubscription) {
      // 구독 관리에서 진입: 스킵 플래그 없이 돌아가기
      router.push("/mypage/settings/subscription");
    } else {
      // 기본: 스킵 플래그 설정 후 위클리 해빗으로
      try { storage.set(PSQI_SKIP_KEY, "true"); } catch {}
      router.push("/wellness/weekly-habit");
    }
  }

  if (!checked) {
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

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.main}>
        {/* 뒤로가기 + 타이틀 */}
        <div className={styles.topBar}>
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
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
          <h1 className={styles.pageTitle}>수면의 질 검사</h1>
          <div className={styles.topBarSpacer} />
        </div>

        <PSQITest
          standalone
          onSubmit={handlePSQISubmit}
          initialResult={existingResult}
          onNavigateToHabit={handleNavigateToHabit}
          onSkip={handleSkip}
          ctaText={isFromSubscription ? "구독 관리로 돌아가기" : undefined}
          skipText={isFromSubscription ? "구독 관리로 돌아가기" : undefined}
        />
      </div>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}

export default function PSQIPage() {
  return (
    <Suspense fallback={null}>
      <PSQIPageContent />
    </Suspense>
  );
}
