"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./player.module.css";

import { isUserLoggedIn, getUserInfo } from "@/auth/user";
import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";
import {
  canPlayVideo,
  getBalanceUserState,
  saveWatchRecord,
  getGiftCycle,
  saveGiftCycle,
  countQualifyingWeeksRolling,
} from "@/auth/subscription";
import SelfCheckSurvey, { hasSelfCheckResult } from "@/components/self-check/SelfCheckSurvey";

import { extractPlayerVideoByWeek, type PlayerVideo } from "./playerBrain";
import * as storage from "@/lib/storage";
import { getUserId } from "@/lib/storage";

// ── 영상 재생 시도 기록 키 ──
const PLAY_ATTEMPTED_KEY = "balance_video_played";

function BalancePlayerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  // ✅ A단계: 프로그램 고정
  const program = "autobalance";

  const [video, setVideo] = useState<PlayerVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostVideoCheck, setShowPostVideoCheck] = useState(false);
  const [showSelfCheck, setShowSelfCheck] = useState(false);
  const [showTrialCTA, setShowTrialCTA] = useState(false);
  const [showStickyBanner, setShowStickyBanner] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hasPlayedThisSessionRef = useRef(false);
  const exitSheetShownRef = useRef(false);
  const trialFlowStartedRef = useRef(false);
  const practiceRecordSentRef = useRef(false);

  // 고객 유형 확인 (비동기 → useState + useEffect)
  const [subType, setSubType] = useState<string>("browser");
  const [subTypeLoaded, setSubTypeLoaded] = useState(false);

  useEffect(() => {
    getBalanceUserState(program).then((state) => {
      setSubType(state.subscription.subscriptionType);
      setSubTypeLoaded(true);
    });
  }, [program]);

  const weekNumber = (() => {
    if (!weekParam) return null;
    const n = Number(weekParam);
    if (Number.isNaN(n)) return null;
    return n;
  })();

  // 고객 유형별 재생 권한 확인
  const playPermission = weekNumber !== null
    ? canPlayVideo(program, weekNumber)
    : null;

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
      router.replace("/wellness/solution");
    }
  }, [playPermission, router]);

  // ─────────────────────────────────────────
  // #5 재방문 시: 스티키 배너로 부드럽게 표시
  // - 이전에 play 버튼을 클릭한 적이 있는 browser 고객
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!subTypeLoaded || subType !== "browser") return;

    try {
      storage.migrateKey(`${PLAY_ATTEMPTED_KEY}_${program}`);
      const played = storage.get(`${PLAY_ATTEMPTED_KEY}_${program}`);
      if (played === "true") {
        // 재방문 → 스티키 배너 표시 (자가 체크 여부 무관하게 배너는 항상 표시)
        setShowStickyBanner(true);
      }
    } catch {}
  }, [subTypeLoaded, subType, program]);

  // ─────────────────────────────────────────
  // #6 이탈 감지: 바텀 시트로 부드럽게, 1회만
  // - 뒤로가기 버튼 감지
  // ─────────────────────────────────────────
  useEffect(() => {
    if (subType !== "browser") return;

    // 뒤로가기 감지를 위한 history 엔트리 추가
    history.pushState({ playerGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (
        hasPlayedThisSessionRef.current &&
        !exitSheetShownRef.current &&
        !trialFlowStartedRef.current
      ) {
        // 바텀 시트 표시 (1회만)
        history.pushState({ playerGuard: true }, "", window.location.href);
        exitSheetShownRef.current = true;
        setShowExitSheet(true);
      } else {
        // 이미 시트를 봤거나 결제 진행 중이면 뒤로가기 허용
        router.back();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [subType, router]);

  // ─────────────────────────────────────────
  // #6 이탈 감지: 다른 링크 클릭 시 바텀 시트
  // ─────────────────────────────────────────
  useEffect(() => {
    if (subType !== "browser") return;

    const handleLinkClick = (e: MouseEvent) => {
      if (!hasPlayedThisSessionRef.current) return;
      if (exitSheetShownRef.current || trialFlowStartedRef.current) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (href.includes("/wellness/solution/player")) return;
      if (href.startsWith("http") && !href.includes(window.location.origin)) return;

      e.preventDefault();
      e.stopPropagation();
      exitSheetShownRef.current = true;
      setShowExitSheet(true);
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [subType]);

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

  // ─────────────────────────────────────────
  // 영상 재생 시: 재생 시도 기록 저장 (AWS + storage)
  // ─────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.focus();
    }

    if (subType === "browser") {
      hasPlayedThisSessionRef.current = true;

      // storage에 재생 시도 기록
      try {
        storage.set(`${PLAY_ATTEMPTED_KEY}_${program}`, "true");
      } catch {}

      // AWS에도 재생 시도 기록
      const token = storage.getRaw("user_id_token");
      if (token) {
        fetch("/api/user/subscription", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            programId: program,
            hasPlayedVideo: true,
          }),
        }).catch(() => {});
      }
    }
  }, [subType, program]);

  // ─────────────────────────────────────────
  // 영상 70% 시청 시: 실천 기록 + 시청 기록 + 선물 사이클 저장
  // ─────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    if (practiceRecordSentRef.current) return;
    const vid = videoRef.current;
    if (!vid || !vid.duration || vid.duration <= 0) return;

    if (vid.currentTime >= vid.duration * 0.7) {
      practiceRecordSentRef.current = true;
      const today = new Date().toISOString().slice(0, 10);

      // 1) AWS에 실천 기록 저장 (기존)
      const token = storage.getRaw("user_id_token");
      fetch("/api/user/practice-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: "solution", date: today }),
      }).catch(() => {});

      // 2) 시청 기록 저장 (localStorage + AWS)
      const userId = getUserId() || "";
      const wk = weekNumber ?? 1;
      saveWatchRecord({
        userId,
        programId: program,
        weekNumber: wk,
        watchDate: today,
        watchDurationSeconds: Math.round(vid.currentTime),
        isCompleted: true,
      }).then(() => {
        // 3) 선물 사이클 업데이트: 달성 주수가 변했으면 저장
        const qualifiedWeeks = countQualifyingWeeksRolling(program);
        const currentCycle = getGiftCycle(program);

        if (qualifiedWeeks !== currentCycle.qualifiedWeeks) {
          const updatedCycle = { ...currentCycle, userId, qualifiedWeeks };

          // 4주 배수 달성 시 선물 해금
          if (qualifiedWeeks > 0 && qualifiedWeeks % 4 === 0 && !currentCycle.giftUnlockedAt) {
            const now = new Date();
            const expires = new Date(now);
            expires.setDate(expires.getDate() + 7);
            updatedCycle.giftUnlockedAt = now.toISOString();
            updatedCycle.giftExpiresAt = expires.toISOString();
          }

          saveGiftCycle(updatedCycle);
        }
      });
    }
  }, [weekNumber, program]);

  // ─────────────────────────────────────────
  // #2 영상 종료 시: 무료 체험 표시
  // ─────────────────────────────────────────
  const handleEnded = useCallback(() => {
    if (subType === "browser") {
      if (!hasSelfCheckResult()) {
        // 자가 체크 미완료 → 설문 유도 프롬프트
        setShowPostVideoCheck(true);
      } else {
        // 자가 체크 완료 → 바로 무료 체험 CTA
        setShowTrialCTA(true);
      }
    }
  }, [subType]);

  // ─────────────────────────────────────────
  // 무료 체험 → pricing 페이지로 이동
  // ─────────────────────────────────────────
  const startTrialFlow = useCallback(() => {
    router.push("/home/pricing");
  }, [router]);

  // 바텀 시트 닫기 → 실제로 이동
  const handleExitSheetClose = useCallback(() => {
    setShowExitSheet(false);
    router.push("/wellness/solution");
  }, [router]);

  return (
    <div className={styles.container}>
      <Header />

      {/* ── #5 재방문 스티키 배너 (부드러운 상단 배너) ── */}
      {showStickyBanner && !showSelfCheck && !showExitSheet && subType === "browser" && (
        <div className={styles.stickyBanner}>
          <p className={styles.stickyBannerText}>
            지난번 영상이 도움이 되셨나요? 무료 체험으로 계속해보세요
          </p>
          <div className={styles.stickyBannerBtns}>
            <button
              className={styles.stickyBannerBtn}
              onClick={startTrialFlow}
            >
              7일 무료 체험
            </button>
            <button
              className={styles.stickyBannerClose}
              onClick={() => setShowStickyBanner(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
              >
                <source src={makeVideoUrl(video.key)} type="video/mp4" />
                브라우저가 HTML5 비디오를 지원하지 않습니다.
              </video>
            </div>

            {/* ── #2 영상 종료 후: 자가 체크 유도 프롬프트 (미완료 시) ── */}
            {showPostVideoCheck && !showSelfCheck && !showTrialCTA && (
              <div className={styles.postVideoPrompt}>
                <p className={styles.postVideoEmoji}>🌿</p>
                <p className={styles.postVideoTitle}>
                  영상은 어떠셨나요?
                </p>
                <p className={styles.postVideoDesc}>
                  1분이면 나의 자율신경 건강 상태를 체크할 수 있어요.
                </p>
                <button
                  className={styles.postVideoCheckBtn}
                  onClick={() => setShowSelfCheck(true)}
                >
                  혹시 나도? 자가 체크하기
                </button>
                <button
                  className={styles.postVideoSkipBtn}
                  onClick={() => setShowPostVideoCheck(false)}
                >
                  다음에 할게요
                </button>
              </div>
            )}

            {/* ── #2 영상 종료 후: 무료 체험 CTA (자가 체크 완료 시) ── */}
            {showTrialCTA && !showSelfCheck && !showExitSheet && (
              <div className={styles.trialCTACard}>
                <p className={styles.trialCTAEmoji}>✨</p>
                <p className={styles.trialCTATitle}>
                  더 많은 변화를 경험해보세요
                </p>
                <p className={styles.trialCTADesc}>
                  7일간 무료로 모든 주차의 영상을 자유롭게 시청할 수 있어요.
                  <br />
                  체험 기간 중 언제든 취소 가능합니다.
                </p>
                <button
                  className={styles.trialCTAPrimaryBtn}
                  onClick={startTrialFlow}
                >
                  7일 무료 체험 시작하기
                </button>
                <button
                  className={styles.trialCTASecondaryBtn}
                  onClick={() => setShowTrialCTA(false)}
                >
                  나중에 할게요
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── #6 이탈 시: 바텀 시트 (부드러운 하단 시트, 1회만) ── */}
      {showExitSheet && (
        <div className={styles.exitSheetBackdrop} onClick={handleExitSheetClose}>
          <div
            className={styles.exitSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.exitSheetHandle} />
            <p className={styles.exitSheetTitle}>
              잠깐, 이런 건 어때요?
            </p>
            <p className={styles.exitSheetDesc}>
              7일 동안 모든 영상을 무료로 시청할 수 있어요.
              <br />
              부담 없이 체험해보세요.
            </p>
            <button
              className={styles.exitSheetPrimaryBtn}
              onClick={startTrialFlow}
            >
              7일 무료 체험 시작하기
            </button>
            <button
              className={styles.exitSheetSecondaryBtn}
              onClick={handleExitSheetClose}
            >
              괜찮아요, 다음에 할게요
            </button>
          </div>
        </div>
      )}

      {/* ── #3 자가 체크 설문 (전체 화면 오버레이) ── */}
      {showSelfCheck && (
        <div className={styles.selfCheckOverlay}>
          <div className={styles.selfCheckModal}>
            <SelfCheckSurvey
              skipIntro
              onSkip={() => {
                setShowSelfCheck(false);
                setShowPostVideoCheck(false);
              }}
              onStartTrial={async () => {
                setShowSelfCheck(false);
                setShowPostVideoCheck(false);
                await startTrialFlow();
              }}
              onWatchFirst={() => {
                setShowSelfCheck(false);
                setShowPostVideoCheck(false);
              }}
            />
          </div>
        </div>
      )}

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
