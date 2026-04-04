"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./home.module.css";
import Image from "next/image";
import Link from "next/link";
import BottomTab from "@/components/BottomTab";
import Header from "@/components/Header";
import WellnessCarousel from "./WellnessCarousel";

// 사용자 인증
import { isUserLoggedIn, getUserName, getUserInfo } from "@/auth/user";
import { getSubscription, getSubscriptionSync, retryPendingSubscriptionSync } from "@/auth/subscription";
import { PROGRAMS_LIST, PROGRAMS, getProgramName, ProgramInfo } from "@/config/programs";
import { USER_API } from "@/config/constants";
import * as storage from "@/lib/storage";
import { onAppResume, onNetworkRestore } from "@/lib/appLifecycle";
import { getSelectedProgram, isSelectionConfirmed, hydrateFromAWS, retryPendingProgramSync } from "@/lib/programSelection";

// 모달은 사용자 인터랙션 시에만 필요 → dynamic import로 코드 스플리팅
const ProgramSelectModal = dynamic(() => import("./ProgramSelectModal"), {
  ssr: false,
});
const ComingSoonModal = dynamic(
  () => import("@/components/publicSite/ComingSoonModal"),
  { ssr: false }
);

// =======================================================
// 프로필 AWS 재전송 함수 (독립 함수로 분리)
// - 홈 진입, 앱 복귀(visibilitychange), 인터넷 복구(online) 시 호출
// - pending 플래그가 있으면 localStorage의 프로필을 AWS에 재전송
// - 중복 실행 방지를 위해 syncInProgress 플래그 사용
// =======================================================
let syncInProgress = false;

async function retryPendingProfileSync(): Promise<void> {
  if (typeof window === "undefined") return;
  if (syncInProgress) return;

  const pending = storage.get("profile_aws_pending");
  if (pending !== "true") return;

  syncInProgress = true;

  try {
    const info = getUserInfo();
    const token = info?.idToken;
    if (!token) return;

    const profile = storage.getJSON("user_profile");
    if (!profile) return;

    const res = await fetch(USER_API.PROFILE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profile),
    });

    if (res.ok) {
      storage.remove("profile_aws_pending");
      console.log("[Profile] AWS 재업로드 성공 (이벤트 트리거)");
    } else {
      console.warn("[Profile] AWS 재업로드 실패:", res.status);
    }
  } catch (err) {
    console.warn("[Profile] AWS 재업로드 중 에러:", err);
  } finally {
    syncInProgress = false;
  }
}

function HomeContent() {
  const router = useRouter();

  // 🔐 보호 페이지: 로그인 여부 확인 + 첫 로그인 시 프로필 설정
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    // 프로필 설정 확인: 스토리지 레이어 → AWS fallback
    async function checkProfileSetup() {
      if (typeof window === "undefined") return;

      // 기존 키 → 사용자별 키 마이그레이션 (최초 1회)
      storage.migrateKey("user_profile");
      storage.migrateKey("profile_setup_done");
      storage.migrateKey("profile_aws_pending");

      const profileDone = storage.get("profile_setup_done");
      if (profileDone) {
        // pending 재시도: 스토리지에 데이터가 있지만 AWS 미전송인 경우
        await retryPendingProfileSync();
        await retryPendingProgramSync();
        await retryPendingSubscriptionSync();
        // 기존 사용자: 프로그램 선택 데이터가 AWS에만 있을 수 있으므로 hydrate
        await hydrateFromAWS();
        refreshConfirmedProgram();
        return; // 프로필 완료 → 홈 유지
      }

      // 스토리지에 없음 → AWS에서 hydrate 시도
      try {
        const info = getUserInfo();
        const token = info?.idToken;
        if (token) {
          const res = await fetch(USER_API.PROFILE, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            console.log("[Profile] AWS 응답 구조:", JSON.stringify(Object.keys(data)));

            // AWS 응답 구조 유연하게 처리:
            // 형태 A: { profile: { wellnessGoal, ... }, profileSetupDone: true }
            // 형태 B: { wellnessGoal, ..., profileSetupDone: true } (플랫 구조)
            const profile = data.profile || data;
            // profileSetupDone은 Lambda에서 실제 데이터 존재 여부도 함께 반영
            // (플래그 OR 프로필 데이터(nickname, dietHabit 등) 존재 시 true)
            const setupDone = data.profileSetupDone || profile.profileSetupDone;

            if (setupDone) {
              // AWS에 프로필 존재 → 스토리지 레이어에 hydrate
              storage.setJSON("user_profile", profile);
              storage.set("profile_setup_done", "true");
              console.log("[Profile] AWS에서 프로필 hydrate 완료");
              // 기존 사용자: 프로그램 선택 데이터도 함께 복원
              await hydrateFromAWS();
              refreshConfirmedProgram();
              return; // 홈 유지
            }
          } else {
            // API 호출은 됐지만 서버 에러 (500 등) → 서버 장애일 수 있으므로
            // 프로필 설정 페이지로 보내지 않고 홈에 유지
            console.warn("[Profile] AWS 프로필 조회 서버 에러:", res.status);
            return;
          }
        }
      } catch (err) {
        // 네트워크 에러 등 → 서버 장애일 수 있으므로
        // 프로필 설정 페이지로 보내지 않고 홈에 유지
        console.warn("[Profile] AWS 프로필 조회 실패 (네트워크 에러):", err);
        return;
      }

      // AWS 응답이 정상이지만 프로필 데이터가 없는 경우에만 프로필 설정 페이지로 이동
      router.replace("/home/profile-setup");
    }

    checkProfileSetup();

    if (typeof window === "undefined") return;

    const handlePopState = () => {
      // 뒤로가기를 눌러도 다시 현재 홈 페이지를 스택에 쌓아서
      // 로그인/랜딩으로 돌아가지 못하게 함
      window.history.pushState(null, "", window.location.href);
    };

    // 현재 /home 상태를 한 번 더 쌓기
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    // 언마운트 시 정리
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  // =======================================================
  // P0 강화: 앱 복귀(visibilitychange) + 인터넷 복구(online) 시
  // pending 프로필 자동 재전송
  // - 모바일에서 다른 앱을 쓰다가 돌아왔을 때
  // - 지하철 등에서 인터넷이 끊겼다가 다시 연결되었을 때
  // =======================================================
  useEffect(() => {
    // 앱 복귀 / 인터넷 복구 시 pending 데이터 자동 재전송
    const retryAll = () => {
      retryPendingProfileSync();
      retryPendingProgramSync();
      retryPendingSubscriptionSync();
    };

    const cleanupResume = onAppResume(retryAll);
    const cleanupNetwork = onNetworkRestore(retryAll);

    return () => {
      cleanupResume();
      cleanupNetwork();
    };
  }, []);

  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightWellness, setHighlightWellness] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [subscribedProgram, setSubscribedProgram] = useState<{
    id: string;
    name: string;
    image: string;
    href: string | null;
  } | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [confirmedProgram, setConfirmedProgram] = useState<ProgramInfo | null>(null);

  // ▶ confirmed 상태 갱신 (browser + confirmed 고객용)
  function refreshConfirmedProgram() {
    const selectedId = getSelectedProgram();
    if (selectedId && isSelectionConfirmed()) {
      const prog = PROGRAMS[selectedId];
      if (prog) {
        setConfirmedProgram(prog);
        return;
      }
    }
    setConfirmedProgram(null);
  }

  // ▶ 사용자 이름 가져오기
  useEffect(() => {
    const name = getUserName();
    setUserName(name);
  }, []);

  // ▶ 구독 상태 확인: 캐시 즉시 표시 → 백그라운드 갱신
  useEffect(() => {
    function findSubscribed(
      getSub: (id: string) => { subscriptionType: string }
    ) {
      for (const prog of PROGRAMS_LIST) {
        const sub = getSub(prog.id);
        if (sub.subscriptionType === "free_trial" || sub.subscriptionType === "paid") {
          return {
            id: prog.id,
            name: prog.name,
            image: prog.image,
            href: prog.route,
          };
        }
      }
      return null;
    }

    // 1단계: 캐시에서 즉시 표시 (로그인 시 prefetch된 데이터)
    const cached = findSubscribed(getSubscriptionSync);
    if (cached) {
      setSubscribedProgram(cached);
      setSubLoaded(true);
    }

    // 2단계: 백그라운드에서 최신 데이터 갱신
    async function refreshSubscriptions() {
      const results = await Promise.all(
        PROGRAMS_LIST.map((prog) => getSubscription(prog.id))
      );

      const fresh = findSubscribed((id) => {
        const idx = PROGRAMS_LIST.findIndex((p) => p.id === id);
        return results[idx];
      });

      // 캐시와 다를 때만 업데이트 (불필요한 리렌더 방지)
      if (fresh?.id !== cached?.id) {
        setSubscribedProgram(fresh);
      }
      setSubLoaded(true);
      // 구독이 없는 경우 confirmed 상태 체크
      if (!fresh) refreshConfirmedProgram();
    }

    refreshSubscriptions();
  }, []);

  // ▶ yoga 탭 → home 리다이렉트 시 웰니스 섹션 하이라이트
  useEffect(() => {
    if (searchParams.get("highlight") === "wellness") {
      // URL에서 query param 제거 (히스토리 오염 방지)
      window.history.replaceState(null, "", "/home");

      // 이미 솔루션을 선택한 고객 → 모달 없이 바로 이동
      const alreadySelected = getSelectedProgram();
      if (alreadySelected && isSelectionConfirmed()) {
        const route = PROGRAMS[alreadySelected]?.route;
        if (route) {
          router.push(route);
          return;
        }
      }

      // 미선택 고객 → 마이 솔루션 모달 열기
      setIsModalOpen(true);
    }
  }, [searchParams, router]);

  const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // 이미 솔루션을 선택한 고객 → 모달 없이 바로 이동
    const alreadySelected = getSelectedProgram();
    if (alreadySelected && isSelectionConfirmed()) {
      const route = PROGRAMS[alreadySelected]?.route;
      if (route) {
        router.push(route);
        return;
      }
    }

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);

    setHighlightWellness(true);
    setTimeout(() => {
      setHighlightWellness(false);
    }, 2000);

    if (typeof document !== "undefined") {
      const target = document.getElementById("wellnessSection");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* 🟦 공통 헤더 */}
      <Header />

      {/* 메인 콘텐츠 */}
      <main className={styles.main}>
        {/* 인사말 */}
        {userName && (
          <div className={styles.greeting}>
            <p className={styles.greetingText}>
              반갑습니다. <strong>{userName}</strong>님
            </p>
          </div>
        )}

        {/* 웰니스 솔루션 */}
        <section className={styles.section} id="wellnessSection">
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleAccent} />
            웰니스 솔루션
          </h2>

          <div className={styles.wellnessGrid}>
            <Link
              href="/wellness/balance"
              className={`${styles.wellnessCard} ${
                highlightWellness ? styles.wellnessHighlight : ""
              }`}
            >
              <div className={styles.wellnessImageWrap}>
                <Image
                  src="/assets/images/webp/balance_reset_square.webp"
                  alt={getProgramName("autobalance")}
                  width={480}
                  height={480}
                  sizes="(max-width: 480px) 45vw, (max-width: 1024px) 40vw, 340px"
                  priority
                  className={styles.wellnessImage}
                />
                <div className={styles.wellnessOverlay}>
                  <p className={styles.wellnessSubText}>
                    전 세계 82만 명이<br />
                    아무도 모르게 앓고 있는 불균형
                  </p>
                  <span className={styles.wellnessAlert}>혹시 나도?</span>
                </div>
              </div>
              <p className={styles.wellnessText}>{getProgramName("autobalance")}</p>
            </Link>

            <div
              className={`${styles.wellnessCard} ${
                highlightWellness ? styles.wellnessHighlight : ""
              }`}
              onClick={() => setShowComingSoon(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setShowComingSoon(true); }}
            >
              <div className={styles.wellnessImageWrap}>
                <Image
                  src="/assets/images/webp/woman_condition_square.webp"
                  alt={getProgramName("womans-whisper")}
                  width={480}
                  height={480}
                  sizes="(max-width: 480px) 45vw, (max-width: 1024px) 40vw, 340px"
                  priority
                  className={styles.wellnessImage}
                />
                <div className={styles.wellnessOverlay}>
                  <p className={styles.wellnessSubText}>
                    당신의 자궁은 안녕한가요?
                  </p>
                </div>
              </div>
              <p className={styles.wellnessText}>
                {getProgramName("womans-whisper")}
              </p>
            </div>
          </div>
        </section>

        {/* 마이 솔루션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionTitleAccent} />
            마이 솔루션
          </h2>

          {!subLoaded ? (
            /* ── 로딩 중: 빈 공간 유지 (깜빡임 방지) ── */
            <div className={styles.mySolutionCard} style={{ minHeight: 120, opacity: 0.5 }}>
              <p className={styles.mySolutionDesc}>불러오는 중...</p>
            </div>
          ) : subscribedProgram ? (
            /* ── 결제 완료: 구독 프로그램 카드 ── */
            <div
              className={styles.mySolutionSubscribed}
              onClick={() => {
                if (subscribedProgram.href) {
                  router.push(subscribedProgram.href);
                } else {
                  setShowComingSoon(true);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (subscribedProgram.href) {
                    router.push(subscribedProgram.href);
                  } else {
                    setShowComingSoon(true);
                  }
                }
              }}
            >
              <div className={styles.subscribedImageWrap}>
                <Image
                  src={subscribedProgram.image}
                  alt={subscribedProgram.name}
                  width={120}
                  height={120}
                  className={styles.subscribedImage}
                />
              </div>
              <div className={styles.subscribedInfo}>
                <p className={styles.subscribedName}>{subscribedProgram.name}</p>
                <span className={styles.subscribedCta}>시작하기 →</span>
              </div>
            </div>
          ) : confirmedProgram ? (
            /* ── 선택 완료 (browser + confirmed): 1주차 무료 체험 중 ── */
            <div
              className={styles.mySolutionConfirmed}
              onClick={() => {
                if (confirmedProgram.route) {
                  router.push(confirmedProgram.route);
                } else {
                  setShowComingSoon(true);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (confirmedProgram.route) {
                    router.push(confirmedProgram.route);
                  } else {
                    setShowComingSoon(true);
                  }
                }
              }}
            >
              <div className={styles.subscribedImageWrap}>
                <Image
                  src={confirmedProgram.image}
                  alt={confirmedProgram.name}
                  width={120}
                  height={120}
                  className={styles.subscribedImage}
                />
              </div>
              <div className={styles.subscribedInfo}>
                <span className={styles.confirmedBadge}>1주차 무료 체험 중</span>
                <p className={styles.confirmedName}>{confirmedProgram.name}</p>
                <span className={styles.confirmedCta}>시작하기 →</span>
              </div>
            </div>
          ) : (
            /* ── 미선택: 무료 체험 CTA ── */
            <div className={styles.mySolutionCard}>
              <span className={styles.mySolutionBadge}>7일 무료 체험</span>
              <p className={styles.mySolutionDesc}>나에게 맞는 맞춤 웰니스를 시작해 보세요</p>
              <button
                type="button"
                className={styles.programCtaButton}
                onClick={handleOpenModal}
              >
                Heal Echo 무료 체험 시작하기
                <span className={styles.ctaArrow}>→</span>
              </button>
            </div>
          )}
        </section>

        {/* ── 웰니스 솔루션 구분자 ── */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerLabel}>맞춤 웰니스 3세트</span>
          <span className={styles.dividerLine} />
        </div>

        {/* 웰니스 솔루션 카드 슬라이드 */}
        <WellnessCarousel />
      </main>

      <div className={styles.tabPadding}></div>

      <BottomTab />

      {isModalOpen && (
        <ProgramSelectModal
          onClose={handleCloseModal}
          onShowComingSoon={() => {
            setIsModalOpen(false);
            setShowComingSoon(true);
          }}
        />
      )}
      <ComingSoonModal
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
