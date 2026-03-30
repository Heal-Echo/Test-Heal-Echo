"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./player.module.css";

import { isUserLoggedIn } from "@/auth/user";
import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { canPlayVideo } from "@/auth/subscription";

import { extractPlayerVideoByWeek, type PlayerVideo } from "./playerBrain";

function BalancePlayerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  // ✅ A단계: 프로그램 고정
  const program = "autobalance";

  const [video, setVideo] = useState<PlayerVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const weekNumber = useMemo(() => {
    if (!weekParam) return null;
    const n = Number(weekParam);
    if (Number.isNaN(n)) return null;
    return n;
  }, [weekParam]);

  // 고객 유형별 재생 권한 확인
  const playPermission = useMemo(() => {
    if (weekNumber === null) return null;
    return canPlayVideo(program, weekNumber);
  }, [program, weekNumber]);

  // 🔐 로그인 체크
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }
  }, [router]);

  // 권한 없는 경우 리다이렉트
  useEffect(() => {
    if (playPermission && !playPermission.allowed) {
      router.replace("/wellness/balance");
    }
  }, [playPermission, router]);

  // 영상 로드
  useEffect(() => {
    async function load() {
      setError(null);
      setVideo(null);

      if (!weekParam) {
        setError("주차 정보가 없습니다.");
        setLoading(false);
        return;
      }

      if (weekNumber === null) {
        setError("잘못된 주차 값입니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const userToken = storage.getRaw("user_id_token");
        const res = await fetch(`/api/public/balance/videos/${program}`, {
          cache: "no-store",
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });

        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        if (!res.ok) {
          console.error("[Balance Player] public balance API error:", data);
          throw new Error(
            `Balance 영상 목록을 불러오지 못했습니다. (status: ${res.status})`
          );
        }

        const found = extractPlayerVideoByWeek(data, weekNumber);

        if (!found) {
          throw new Error("해당 주차의 영상을 찾을 수 없습니다.");
        }

        setVideo(found);
      } catch (e: any) {
        console.error("[Balance Player]", e);
        setError(e?.message || "영상 로딩 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [weekParam, weekNumber, program]);

  // 영상 재생 시 포커스 (방향키 즉시 작동)
  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.focus();
    }
  }, []);

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {loading && <p className={styles.message}>영상 불러오는 중...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && video && (
          <>
            <h1 className={styles.title}>
              {video.title ?? `${weekParam}주차 영상`}
            </h1>

            <div className={styles.videoWrapper}>
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                tabIndex={0}
                className={styles.video}
                controlsList="nodownload"
                poster={
                  video.thumbnailKey
                    ? makeThumbnailUrl(video.thumbnailKey)
                    : undefined
                }
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
