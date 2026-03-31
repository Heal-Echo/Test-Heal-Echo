// src/app/wellness/solution/self-check/page.tsx
"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./selfcheck.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import SelfCheckSurvey, {
  hasSelfCheckResult,
  fetchAndHydrateSelfCheckResult,
  retryPendingSelfCheckSync,
} from "@/components/self-check/SelfCheckSurvey";
import { isUserLoggedIn } from "@/auth/user";

function SelfCheckPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  // 🔐 로그인 확인 (Home 페이지 패턴)
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 마운트 시: 서버에서 기존 자가 체크 결과 hydrate (Solution 페이지 패턴)
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function init() {
      await fetchAndHydrateSelfCheckResult();
      setHydrated(true);

      // 이미 완료된 경우 구독 관리에서 온 게 아니라면 결과 페이지로 안내
      if (from !== "subscription" && hasSelfCheckResult()) {
        router.replace("/wellness/solution/self-check/result");
      }
    }
    init();
  }, [from, router]);

  // 앱 복귀(visibilitychange) + 인터넷 복구(online) 시 pending 데이터 재전송 (Home 패턴)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retryPendingSelfCheckSync();
      }
    };

    const handleOnline = () => {
      retryPendingSelfCheckSync();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // 구독 관리 페이지에서 진입한 경우
  const isFromSubscription = from === "subscription";

  // 콜백 분기
  const handleSkip = () => {
    if (isFromSubscription) {
      router.back();
    } else {
      router.push("/wellness/solution/player?week=1");
    }
  };

  const handleStartTrial = () => {
    if (isFromSubscription) {
      // 검사 완료 → 결과 페이지로 이동
      router.push("/wellness/solution/self-check/result");
    } else {
      router.push("/home/pricing");
    }
  };

  const handleWatchFirst = () => {
    if (isFromSubscription) {
      // 구독 관리로 돌아가기
      router.push("/mypage/settings/subscription");
    } else {
      router.push("/wellness/solution/player?week=1");
    }
  };

  // hydrate 완료 전에는 로딩 표시 (리다이렉트 판단 전 인트로 노출 방지)
  if (!hydrated) {
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

      <SelfCheckSurvey
        onSkip={handleSkip}
        onStartTrial={handleStartTrial}
        onWatchFirst={handleWatchFirst}
        primaryCtaText={isFromSubscription ? "나의 결과 자세히 보기" : undefined}
        secondaryCtaText={isFromSubscription ? "구독 관리로 돌아가기" : undefined}
      />

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}

export default function SelfCheckPage() {
  return (
    <Suspense fallback={null}>
      <SelfCheckPageContent />
    </Suspense>
  );
}
