"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./balance.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";

import { isUserLoggedIn, getUserName, getUserInfo } from "@/auth/user";
import * as storage from "@/lib/storage";
import { makeThumbnailUrl } from "@/config/constants";
import SelfCheckSurvey, { hasSelfCheckResult, getSavedSelfCheckResult, fetchAndHydrateSelfCheckResult, getSignalIntensity, getSignalGrade, retryPendingSelfCheckSync } from "@/components/self-check/SelfCheckSurvey";
import {
  getBalanceUserState,
  canPlayVideo,
  getGiftProgressMessage,
  getCompletedDates,
  daysUntilNextWeek,
  getExpectedGiftDate,
  formatKoreanDate,
  getEncouragementMessage,
  retryPendingBalanceSync,
} from "@/auth/subscription";
import { getProgramName } from "@/config/programs";
import type { BalanceUserState } from "@/types/subscription";
import { getSelectedProgram } from "@/lib/programSelection";

type BalanceItem = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
  isPublished?: boolean;
};



// ─────────────────────────────────────────
// 달력 유틸 (mypage 패턴 기반)
// ─────────────────────────────────────────
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function SolutionPage() {
  const router = useRouter();

  // 통합 함수에서 선택된 프로그램 확인 (현재는 autobalance만 활성)
  const program = getSelectedProgram() || "autobalance";

  const [showSelfCheck, setShowSelfCheck] = useState(false);
  const [selfCheckSkipIntro, setSelfCheckSkipIntro] = useState(false);
  const [showLockedTrialCTA, setShowLockedTrialCTA] = useState(false);
  const [showStickyBanner, setShowStickyBanner] = useState(false);

  const [thumbByWeek, setThumbByWeek] = useState<Record<number, { url: string; title: string }>>({});
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // 🔐 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 사용자 이름 가져오기
  useEffect(() => {
    const name = getUserName();
    setUserName(name);
  }, []);

  // ── 마운트 시: 서버에서 자가 체크 결과 hydrate ──
  const [selfCheckHydrated, setSelfCheckHydrated] = useState(false);

  useEffect(() => {
    async function init() {
      // 서버에서 기존 자가 체크 결과 hydrate (storage에 없으면 복원)
      await fetchAndHydrateSelfCheckResult();
      setSelfCheckHydrated(true);

      // 자가 체크 미완료 → 자가 체크 팝업 자동 표시
      if (!hasSelfCheckResult()) {
        setShowSelfCheck(true);
      }
    }
    init();
  }, []);

  // ─────────────────────────────────────────
  // 고객 상태 조회
  // ─────────────────────────────────────────
  const [userState, setUserState] = useState<BalanceUserState>({
    subscription: { userId: "", programId: program, subscriptionType: "browser", startDate: null, currentWeek: 1, status: "active", pausedAt: null, trialEndDate: null },
    watchRecords: [],
    giftCycle: { userId: "", programId: program, cycleNumber: 1, qualifiedWeeks: 0, giftUnlockedAt: null, giftExpiresAt: null, giftVideoId: null },
    isGiftWeek: false,
    daysWatchedThisWeek: 0,
    qualifiedWeeksRolling: 0,
    daysInRecentWindow: 0,
    encouragementMessage: null,
  });

  useEffect(() => {
    getBalanceUserState(program).then(setUserState);
  }, [program]);

  // ─────────────────────────────────────────
  // P0 강화: 앱 복귀(visibilitychange) + 인터넷 복구(online) 시
  // pending 데이터 자동 재전송 + 서버 데이터 갱신
  // - Home 페이지의 retryPendingProfileSync() 패턴과 동일
  // - 모바일에서 다른 앱을 쓰다가 돌아왔을 때
  // - 지하철 등에서 인터넷이 끊겼다가 다시 연결되었을 때
  // ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // pending 데이터 재전송 (시청 기록, 선물 사이클, selfcheck)
        retryPendingBalanceSync(program);
        retryPendingSelfCheckSync();
        // 서버 데이터 갱신 (최신 상태 반영)
        getBalanceUserState(program).then(setUserState);
      }
    };

    const handleOnline = () => {
      retryPendingBalanceSync(program);
      retryPendingSelfCheckSync();
      getBalanceUserState(program).then(setUserState);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [program]);

  const currentWeek = userState.subscription.currentWeek;
  const subType = userState.subscription.subscriptionType;

  // ─────────────────────────────────────────
  // 재방문 감지: 영상 시청 이력이 있는 browser 고객에게 배너 표시
  // ─────────────────────────────────────────
  useEffect(() => {
    if (subType !== "browser") return;
    try {
      storage.migrateKey(`balance_video_played_${program}`);
      const played = storage.get(`balance_video_played_${program}`);
      if (played === "true") {
        setShowStickyBanner(true);
      }
    } catch {}
  }, [subType, program]);

  // ─────────────────────────────────────────
  // 썸네일 로드 (현재 주차만)
  // ─────────────────────────────────────────
  useEffect(() => {
    async function loadThumbs() {
      try {
        setLoadingThumbs(true);

        const userToken = storage.getRaw("user_id_token");
        const res = await fetch(`/api/public/balance/videos/${program}`, {
          cache: "no-store",
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });

        if (!res.ok) {
          console.warn("[Balance Page] Failed to load balance list:", res.status);
          return;
        }

        const data = await res.json();
        const items: BalanceItem[] = Array.isArray(data) ? data : data?.items ?? [];

        const next: Record<number, { url: string; title: string }> = {};
        for (const v of items) {
          if (!v?.weekNumber) continue;
          next[Number(v.weekNumber)] = {
            url: v.thumbnailKey ? makeThumbnailUrl(v.thumbnailKey) : "",
            title: v.title || `${v.weekNumber}주차 영상`,
          };
        }

        setThumbByWeek(next);
      } catch (e) {
        console.warn("[Balance Page] Thumb load error:", e);
      } finally {
        setLoadingThumbs(false);
      }
    }

    loadThumbs();
  }, [program]);

  // 현재 주차 썸네일 & 제목
  const currentThumb = useMemo(() => thumbByWeek[currentWeek], [thumbByWeek, currentWeek]);

  // ─────────────────────────────────────────
  // 영상 클릭 핸들러 (고객 유형별 분기)
  // ─────────────────────────────────────────
  const handleVideoClick = useCallback(() => {
    const result = canPlayVideo(program, currentWeek);

    if (!result.allowed) {
      if (result.reason === "payment_required") {
        // #4 잠금 콘텐츠 클릭: 자가 체크 미완료면 설문 유도
        if (!hasSelfCheckResult()) {
          setShowSelfCheck(true);
          return;
        }
        // 자가 체크 완료 → 무료 체험 CTA 모달 표시 (손실 회피 + 명확한 의도)
        setShowLockedTrialCTA(true);
        return;
      }
      if (result.reason === "week_locked") {
        const remaining = daysUntilNextWeek(
          userState.subscription.startDate,
          currentWeek
        );
        alert(`${remaining}일 후에 열립니다.`);
        return;
      }
      if (result.reason === "expired") {
        alert("여기까지 실천하셨어요. 이어서 해보시겠어요?");
        return;
      }
      return;
    }

    // 둘러보는 고객 1주차: 자가 체크 미완료 시 설문 먼저 표시
    if (subType === "browser" && !hasSelfCheckResult()) {
      setShowSelfCheck(true);
      return;
    }

    router.push(`/wellness/solution/player?week=${currentWeek}`);
  }, [program, currentWeek, userState, subType, router]);

  // ─────────────────────────────────────────
  // #4 무료 체험 → pricing 페이지로 이동
  // ─────────────────────────────────────────
  const startTrialFlow = useCallback(() => {
    router.push("/home/pricing");
  }, [router]);

  // ─────────────────────────────────────────
  // 선물 진행도 메시지
  // ─────────────────────────────────────────
  const giftMessage = useMemo(
    () => getGiftProgressMessage(userState.giftCycle, userName),
    [userState.giftCycle, userName]
  );

  // 선물 예상 수령일 (롤링 달성 주수 기반 → 미달성 시 자동으로 밀림)
  const expectedGiftDate = useMemo(
    () => getExpectedGiftDate(userState.giftCycle, userState.qualifiedWeeksRolling),
    [userState.giftCycle, userState.qualifiedWeeksRolling]
  );

  // 응원 메시지 (최근 7일 시청 일수 + 달성 주수 기반)
  const encouragement = useMemo(
    () => getEncouragementMessage(userState.daysInRecentWindow, userState.qualifiedWeeksRolling, userName),
    [userState.daysInRecentWindow, userState.qualifiedWeeksRolling, userName]
  );

  // 선물 예상일의 날짜 문자열 (달력 표시용)
  const giftDateStr = useMemo(() => {
    if (!expectedGiftDate) return null;
    return toDateStr(
      expectedGiftDate.getFullYear(),
      expectedGiftDate.getMonth(),
      expectedGiftDate.getDate()
    );
  }, [expectedGiftDate]);

  // ─────────────────────────────────────────
  // 달력 상태
  // ─────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCompletedDates(getCompletedDates(program));
  }, [program, userState.watchRecords]);

  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const goToPrevMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalMonth((prev) => {
      if (prev === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  // 이번 달 시청 완료 일수
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const playCountThisMonth = Array.from(completedDates).filter((d) =>
    d.startsWith(monthPrefix)
  ).length;

  return (
    <div className={styles.container}>
      <Header />

      {/* ── 재방문 고객 무료 체험 배너 ── */}
      {showStickyBanner && !showSelfCheck && subType === "browser" && (
        <div className={styles.stickyBanner}>
          <p className={styles.stickyBannerText}>
            지난번 영상이 도움이 되셨나요? 무료 체험으로 계속해보세요
          </p>
          <div className={styles.stickyBannerBtns}>
            <button className={styles.stickyBannerBtn} onClick={startTrialFlow}>
              7일 무료 체험
            </button>
            <button
              className={styles.stickyBannerClose}
              onClick={() => setShowStickyBanner(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <h1 className={styles.title}>{getProgramName(program)}</h1>

        {/* ── 자가 체크: 미완료 → 시작 카드 / 완료 → 결과 카드 ── */}
        {!showSelfCheck && (
          (() => {
            const savedResult = getSavedSelfCheckResult();
            if (!savedResult) {
              // 미완료: 자가 체크 시작 카드
              return (
                <section className={styles.selfCheckCard}>
                  <div className={styles.selfCheckCardInner}>
                    <p className={styles.selfCheckCardEmoji}>🌿</p>
                    <p className={styles.selfCheckCardTitle}>혹시 나도?</p>
                    <p className={styles.selfCheckCardDesc}>
                      1분이면 나의 자율신경 건강 상태를 알 수 있어요.
                    </p>
                    <button
                      className={styles.selfCheckCardBtn}
                      onClick={() => {
                        setSelfCheckSkipIntro(true);
                        setShowSelfCheck(true);
                      }}
                    >
                      자가 체크 시작하기
                    </button>
                  </div>
                </section>
              );
            }
            // 완료: 불균형 신호 강도 결과 카드 (클릭 → 독립 결과 페이지)
            const intensity = getSignalIntensity(savedResult.categories);
            const gradeInfo = getSignalGrade(intensity);
            return (
              <section
                className={styles.selfCheckResultCard}
                onClick={() => router.push("/wellness/solution/self-check/result")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") router.push("/wellness/solution/self-check/result"); }}
              >
                <div className={styles.resultCardScoreSection}>
                  <div className={styles.resultCardScoreCircle} style={{ borderColor: gradeInfo.color }}>
                    <span className={styles.resultCardScoreNum} style={{ color: gradeInfo.color }}>
                      {intensity}
                    </span>
                    <span className={styles.resultCardScoreUnit} style={{ color: gradeInfo.color }}>%</span>
                  </div>
                  <div className={styles.resultCardScoreInfo}>
                    <span className={styles.resultCardScoreLabel}>불균형 신호 강도</span>
                    <div className={styles.resultCardGradeRow}>
                      <span className={styles.resultCardGradeBadge} style={{ background: gradeInfo.color }}>
                        {gradeInfo.grade}
                      </span>
                      <span className={styles.resultCardGap} style={{ color: gradeInfo.color }}>
                        {gradeInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={styles.resultCardArrow}>›</span>
              </section>
            );
          })()
        )}

        {/* ── 현재 주차 영상 (썸네일 1개 + 제목) ── */}
        <section className={styles.currentVideoSection}>
          <div
            className={styles.currentVideoCard}
            onClick={handleVideoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") handleVideoClick(); }}
          >
            <div className={styles.thumbnailWrapper}>
              <img
                src={currentThumb?.url || "/assets/images/sample_current.png"}
                alt={`${currentWeek}주차 영상`}
                className={styles.currentThumbnail}
              />
              {loadingThumbs && (
                <div className={styles.loadingOverlay}>
                  <span className={styles.loadingText}>불러오는 중…</span>
                </div>
              )}
              {/* 둘러보는 고객: 2주차 이상은 잠금 */}
              {subType === "browser" && currentWeek !== 1 && (
                <div className={styles.lockOverlay}>
                  <span className={styles.lockIcon}>🔒</span>
                  <span className={styles.lockText}>무료 체험 시작하기</span>
                </div>
              )}
            </div>
            <div className={styles.currentVideoInfo}>
              <p className={styles.weekBadge}>{currentWeek}주차</p>
              <p className={styles.videoTitle}>
                {currentThumb?.title || `${currentWeek}주차 영상`}
              </p>
            </div>
          </div>

          {/* 선물 주차: 선물 영상 카드 추가 */}
          {userState.isGiftWeek && (
            <div
              className={styles.giftVideoCard}
              onClick={() => {
                // TODO: 선물 영상 재생 페이지 연결
                alert("🎁 선물 영상을 재생합니다!");
              }}
              role="button"
              tabIndex={0}
            >
              <div className={styles.giftBadge}>🎁 선물</div>
              <p className={styles.giftVideoTitle}>이번 주 특별 선물 영상</p>
              <p className={styles.giftVideoSub}>7일간만 시청 가능</p>
            </div>
          )}
        </section>

        {/* ── 선물 진행도 메시지 (유료 고객만) ── */}
        {giftMessage && subType === "paid" && (
          <section className={styles.giftProgressSection}>
            <p className={styles.giftProgressText}>{giftMessage}</p>
          </section>
        )}

        {/* ── 이번 주 실천 현황 (유료 고객만) ── */}
        {subType === "paid" && (
          <section className={styles.weekProgressSection}>
            <div className={styles.weekProgressBar}>
              <div className={styles.weekProgressLabel}>
                이번 주 실천
              </div>
              <div className={styles.weekProgressDots}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div
                    key={day}
                    className={`${styles.progressDot} ${
                      day <= userState.daysWatchedThisWeek
                        ? styles.progressDotFilled
                        : ""
                    } ${day === 3 ? styles.progressDotTarget : ""}`}
                  />
                ))}
              </div>
              <div className={styles.weekProgressCount}>
                {userState.daysWatchedThisWeek}/7일
                {userState.daysWatchedThisWeek >= 3 && (
                  <span className={styles.weekProgressCheck}> ✓ 달성</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── 선물 안내 ── */}
        {expectedGiftDate && (
          <section className={styles.giftDateSection}>
            <p className={styles.giftDateTitle}>🎁 4주 뒤, 선물 하나.</p>
            <p className={styles.giftDateText}>
              {userName || "회원"}님,{" "}
              <strong>{formatKoreanDate(expectedGiftDate)}</strong>까지 주 3일만 함께해요!
            </p>
          </section>
        )}

        {/* ── 응원 메시지 (유료 고객만, 달력 위) ── */}
        {encouragement && subType === "paid" && (
          <section className={styles.encouragementSection}>
            <p className={styles.encouragementText}>{encouragement}</p>
          </section>
        )}

        {/* ── 달력 ── */}
        <section className={styles.calendarSection}>
          <h2 className={styles.calendarTitle}>실천 달력</h2>
          <div className={styles.calendarHeader}>
            <div className={styles.calendarNav}>
              <button
                className={styles.calendarNavBtn}
                onClick={goToPrevMonth}
                aria-label="이전 달"
              >
                ‹
              </button>
              <span className={styles.calendarMonth}>
                {calYear}년 {calMonth + 1}월
              </span>
              <button
                className={styles.calendarNavBtn}
                onClick={goToNextMonth}
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
          </div>

          <div className={styles.calendarWeekdays}>
            {WEEKDAYS.map((day) => (
              <div key={day} className={styles.weekdayCell}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.dayCell} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = toDateStr(calYear, calMonth, day);
              const isToday = dateStr === todayStr;
              const isPlayed = completedDates.has(dateStr);
              const isGiftDay = dateStr === giftDateStr;

              return (
                <div key={day} className={styles.dayCell}>
                  {isGiftDay && (
                    <span className={styles.giftDrop}>🎁</span>
                  )}
                  <div
                    className={[
                      styles.dayNumber,
                      isPlayed ? styles.dayPlayed : "",
                      isToday ? styles.dayToday : "",
                      isGiftDay ? styles.dayGift : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.calendarFooter}>
            <div className={styles.calendarFooterLeft}>
              <span className={styles.calendarFooterDot} />
              <span className={styles.calendarFooterText}>
                {playCountThisMonth === 0
                  ? "오늘이 시작하기 가장 좋은 날이예요."
                  : playCountThisMonth <= 2
                    ? `이번 달 ${playCountThisMonth}일 실천 — 좋은 시작이에요!`
                    : `이번 달 ${playCountThisMonth}일 실천`}
              </span>
            </div>
            <span className={styles.calendarFooterRight}>
              {(() => {
                const cycleBase = Math.floor((currentWeek - 1) / 4) * 4;
                const weekInCycle = ((currentWeek - 1) % 4) + 1;
                return cycleBase > 0
                  ? `${cycleBase}+${weekInCycle}주차`
                  : `${weekInCycle}주차`;
              })()} {userState.daysWatchedThisWeek}일 실천
            </span>
          </div>
        </section>

        {/* ── 선물 조건 안내 ── */}
        <p className={styles.giftConditionText}>
          주 3회 이상, 4주의 실천이 쌓이면 선물이 제공됩니다.
        </p>
      </main>

      <div className={styles.tabPadding}></div>
      <BottomTab />

      {/* ── #4 잠금 콘텐츠 클릭 시: 무료 체험 CTA 모달 ── */}
      {showLockedTrialCTA && (
        <div className={styles.selfCheckOverlay}>
          <div className={styles.lockedTrialModal}>
            <p className={styles.lockedTrialEmoji}>🔓</p>
            <p className={styles.lockedTrialTitle}>
              이 콘텐츠는 무료 체험으로 열 수 있어요
            </p>
            <p className={styles.lockedTrialDesc}>
              7일간 무료로 모든 주차의 영상을 자유롭게 시청할 수 있어요.
              <br />
              체험 기간 중 언제든 취소 가능합니다.
            </p>
            <button
              className={styles.lockedTrialPrimaryBtn}
              onClick={() => {
                setShowLockedTrialCTA(false);
                startTrialFlow();
              }}
            >
              7일 무료 체험 시작하기
            </button>
            <button
              className={styles.lockedTrialSecondaryBtn}
              onClick={() => setShowLockedTrialCTA(false)}
            >
              나중에 할게요
            </button>
          </div>
        </div>
      )}

      {/* ── 자가 체크 설문 (둘러보기 고객) ── */}
      {showSelfCheck && (
        <div className={styles.selfCheckOverlay}>
          <div className={styles.selfCheckModal}>
            <SelfCheckSurvey
              skipIntro={selfCheckSkipIntro}
              onSkip={() => {
                setShowSelfCheck(false);
                setSelfCheckSkipIntro(false);
              }}
              onStartTrial={async () => {
                setShowSelfCheck(false);
                setSelfCheckSkipIntro(false);
                await startTrialFlow();
              }}
              onWatchFirst={() => {
                setShowSelfCheck(false);
                setSelfCheckSkipIntro(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
