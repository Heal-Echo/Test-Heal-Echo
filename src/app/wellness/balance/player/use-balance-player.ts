// src/app/wellness/balance/player/use-balance-player.ts
// =======================================================
// Balance Player 커스텀 훅
// - 영상 로딩, 권한 체크, 로그인 가드 로직 분리
// =======================================================

"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { isUserLoggedIn, getValidUserInfo } from "@/auth/user";
import { canPlayVideo } from "@/auth/subscription";
import { PROGRAM_ID } from "@/config/programs";
import type { BalanceVideo } from "@/types/balance";

import { extractBalanceVideoByWeek } from "./player-brain";

const PROGRAM = PROGRAM_ID.AUTOBALANCE;

export type DenialReason = "payment_required" | "week_locked" | "expired";

export function useBalancePlayer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  const [video, setVideo] = useState<BalanceVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [denialReason, setDenialReason] = useState<DenialReason | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const weekNumber = useMemo(() => {
    if (!weekParam) return null;
    const n = Number(weekParam);
    if (Number.isNaN(n)) return null;
    return n;
  }, [weekParam]);

  const playPermission = useMemo(() => {
    if (weekNumber === null) return null;
    return canPlayVideo(PROGRAM, weekNumber);
  }, [weekNumber]);

  // 로그인 체크
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 권한 없는 경우 → reason별 안내 메시지 설정
  useEffect(() => {
    if (playPermission && !playPermission.allowed) {
      setDenialReason(playPermission.reason as DenialReason);
      setIsLoading(false);
    }
  }, [playPermission]);

  // 영상 로드 (권한 거부 시 스킵)
  useEffect(() => {
    async function load() {
      if (playPermission && !playPermission.allowed) return;

      setError(null);
      setVideo(null);

      if (weekNumber === null) {
        setError(weekParam ? "잘못된 주차 값입니다." : "주차 정보가 없습니다.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const userInfo = await getValidUserInfo();
        const userToken = userInfo?.idToken ?? null;
        const res = await fetch(`/api/public/balance/videos/${PROGRAM}`, {
          cache: "no-store",
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });

        const text = await res.text();
        let data: Record<string, unknown> | null = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        if (!res.ok) {
          console.error("[Balance Player] public balance API error:", data);
          throw new Error(`Balance 영상 목록을 불러오지 못했습니다. (status: ${res.status})`);
        }

        const found = extractBalanceVideoByWeek(data, weekNumber);

        if (!found) {
          throw new Error("해당 주차의 영상을 찾을 수 없습니다.");
        }

        setVideo(found);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "영상 로딩 중 오류가 발생했습니다.";
        console.error("[Balance Player]", e);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [weekNumber, weekParam, retryCount, playPermission]);

  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.focus();
    }
  }, []);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return {
    video,
    isLoading,
    error,
    weekParam,
    videoRef,
    handlePlay,
    retry,
    denialReason,
  };
}
