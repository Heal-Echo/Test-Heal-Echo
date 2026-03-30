// src/app/wellness/solution/self-check/page.tsx
"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./selfcheck.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import SelfCheckSurvey from "@/components/self-check/SelfCheckSurvey";

function SelfCheckPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

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
