"use client";

import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import styles from "./player.module.css";

import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";
import { useBalancePlayer } from "./use-balance-player";
import type { DenialReason } from "./use-balance-player";

const DENIAL_CONFIG: Record<
  DenialReason,
  { title: string; description: string; primaryLabel: string; primaryHref: string }
> = {
  payment_required: {
    title: "결제가 필요한 콘텐츠입니다",
    description: "이 주차의 영상을 시청하려면 구독이 필요합니다.\n무료 체험으로 시작해 보세요.",
    primaryLabel: "구독 시작하기",
    primaryHref: "/public/pricing",
  },
  week_locked: {
    title: "아직 열리지 않은 주차입니다",
    description: "이전 주차의 영상을 먼저 시청해 주세요.\n조건을 충족하면 자동으로 열립니다.",
    primaryLabel: "돌아가기",
    primaryHref: "/wellness/balance",
  },
  expired: {
    title: "구독이 만료되었습니다",
    description:
      "구독 기간이 종료되어 영상을 시청할 수 없습니다.\n다시 구독하면 이어서 시청할 수 있습니다.",
    primaryLabel: "다시 구독하기",
    primaryHref: "/public/pricing",
  },
};

function DenialOverlay({ reason }: { reason: DenialReason }) {
  const router = useRouter();
  const config = DENIAL_CONFIG[reason];

  return (
    <div
      className={styles.paywallOverlay}
      role="dialog"
      aria-labelledby="denial-title"
      aria-describedby="denial-desc"
    >
      <div className={styles.paywallCard}>
        <p className={styles.paywallTitle} id="denial-title">
          {config.title}
        </p>
        <p className={styles.paywallDesc} id="denial-desc">
          {config.description}
        </p>
        <button
          className={styles.paywallPrimaryBtn}
          onClick={() => router.push(config.primaryHref)}
          aria-label={config.primaryLabel}
        >
          {config.primaryLabel}
        </button>
        <button
          className={styles.paywallSecondaryBtn}
          onClick={() => router.back()}
          aria-label="이전 페이지로 돌아가기"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}

function BalancePlayerPageContent() {
  const { video, isLoading, error, weekParam, videoRef, handlePlay, retry, denialReason } =
    useBalancePlayer();

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {isLoading && (
          <p className={styles.message} role="status">
            영상 불러오는 중...
          </p>
        )}
        {error && (
          <div role="alert">
            <p className={styles.error}>{error}</p>
            <button className={styles.retryBtn} onClick={retry} aria-label="다시 시도">
              다시 시도
            </button>
          </div>
        )}

        {denialReason && <DenialOverlay reason={denialReason} />}

        {!isLoading && !error && !denialReason && video && (
          <>
            <h1 className={styles.title}>{video.title ?? `${weekParam}주차 영상`}</h1>

            <div className={styles.videoWrapper}>
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                tabIndex={0}
                className={styles.video}
                controlsList="nodownload"
                aria-label={video.title ?? `${weekParam}주차 영상`}
                poster={video.thumbnailKey ? makeThumbnailUrl(video.thumbnailKey) : undefined}
                onPlay={handlePlay}
              >
                <source src={makeVideoUrl(video.key)} type="video/mp4" />
                브라우저가 HTML5 비디오를 지원하지 않습니다.
              </video>
            </div>
          </>
        )}
      </main>

      <div className={styles.tabPadding}></div>
      <BottomTab />
    </div>
  );
}

export default function BalancePlayerPage() {
  return (
    <Suspense fallback={null}>
      <BalancePlayerPageContent />
    </Suspense>
  );
}
