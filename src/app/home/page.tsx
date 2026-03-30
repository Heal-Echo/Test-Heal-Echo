"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./home.module.css";
import Image from "next/image";
import Link from "next/link";
import BottomTab from "@/components/BottomTab";
import Header from "@/components/Header";
import ComingSoonModal from "@/components/publicSite/ComingSoonModal";

// 사용자 인증
import { isUserLoggedIn, getUserName, getUserInfo } from "@/auth/user";
import { getSubscription } from "@/auth/subscription";
import { PROGRAMS_LIST, getProgramName } from "@/config/programs";
import * as storage from "@/lib/storage";
import { syncProgramSelection, getSelectedProgram, isSelectionConfirmed } from "@/lib/programSelection";

const WELLNESS_SLIDES = [
  {
    href: "/wellness/solution",
    image: "/assets/images/solutions.png",
    alt: "위클리 솔루션",
    label: "위클리 솔루션",
    desc: "하루 15분, 나를 위한 맞춤 요가 클래스",
  },
  {
    href: "/wellness/weekly-habit",
    image: "/assets/images/healing_recipe_square.png",
    alt: "위클리 해빗",
    label: "위클리 해빗",
    desc: "쉽게 실천 가능한 수면 습관과 식습관",
  },
  {
    href: "/understanding",
    image: "/assets/images/Ocean_of_Understanding_crop1.png",
    alt: "이해의 바다",
    label: "이해의 바다",
    desc: "조건없이 나를 이해하는 시간",
  },
];

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

    const res = await fetch("/api/user/profile", {
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
        // pending 재시도: 스토리지에 프로필이 있지만 AWS 미전송인 경우
        await retryPendingProfileSync();
        return; // 프로필 완료 → 홈 유지
      }

      // 스토리지에 없음 → AWS에서 hydrate 시도
      try {
        const info = getUserInfo();
        const token = info?.idToken;
        if (token) {
          const res = await fetch("/api/user/profile", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.profile && data.profileSetupDone) {
              // AWS에 프로필 존재 → 스토리지 레이어에 hydrate
              storage.setJSON("user_profile", data.profile);
              storage.set("profile_setup_done", "true");
              console.log("[Profile] AWS에서 프로필 hydrate 완료");
              return; // 홈 유지
            }
          }
        }
      } catch (err) {
        console.warn("[Profile] AWS 프로필 조회 실패:", err);
      }

      // AWS에도 없으면 프로필 설정 페이지로 이동
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
    if (typeof window === "undefined") return;

    // 앱 복귀 감지: 다른 앱 → 다시 돌아왔을 때
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retryPendingProfileSync();
      }
    };

    // 인터넷 복구 감지: 오프라인 → 온라인 전환 시
    const handleOnline = () => {
      retryPendingProfileSync();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    // 언마운트 시 정리
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightWellness, setHighlightWellness] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [subscribedProgram, setSubscribedProgram] = useState<{
    id: string;
    name: string;
    image: string;
    href: string | null;
  } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // 카루셀 스크롤 감지
  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth
      : 1;
    const gap = 10;
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveSlide(Math.min(index, WELLNESS_SLIDES.length - 1));
  }, []);

  const scrollToSlide = (index: number) => {
    const el = carouselRef.current;
    if (!el || !el.firstElementChild) return;
    const cardWidth = (el.firstElementChild as HTMLElement).offsetWidth;
    const gap = 10;
    el.scrollTo({ left: index * (cardWidth + gap), behavior: "smooth" });
  };

  // 마우스 드래그 스크롤 (데스크톱)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragMoved = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    isDragging.current = true;
    dragMoved.current = false;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragScrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.scrollSnapType = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const el = carouselRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    // 5px 이상 움직이면 드래그로 판정 → 클릭 방지
    if (Math.abs(x - dragStartX.current) > 5) {
      dragMoved.current = true;
    }
    el.scrollLeft = dragScrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = carouselRef.current;
    if (!el) return;
    el.style.cursor = "grab";
    setTimeout(() => {
      el.style.scrollSnapType = "x mandatory";
    }, 50);
  }, []);

  // 드래그 후 링크 클릭 방지
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (dragMoved.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // ▶ 사용자 이름 가져오기
  useEffect(() => {
    const name = getUserName();
    setUserName(name);
  }, []);

  // ▶ 구독 상태 확인 (서버 API에서 조회 → 결제 완료 시 프로그램 카드 표시)
  useEffect(() => {
    // 프로그램별 이동 경로 (향후 확장 시 여기에 추가)
    const PROGRAM_HREF: Record<string, string | null> = {
      autobalance: "/wellness/balance",
      "womans-whisper": null, // 향후 설정 예정
    };

    async function checkSubscriptions() {
      for (const prog of PROGRAMS_LIST) {
        const sub = await getSubscription(prog.id);
        if (sub.subscriptionType === "free_trial" || sub.subscriptionType === "paid") {
          setSubscribedProgram({
            id: prog.id,
            name: prog.name,
            image: prog.image,
            href: PROGRAM_HREF[prog.id] ?? null,
          });
          return;
        }
      }
    }

    checkSubscriptions();
  }, []);

  // ▶ yoga 탭 → home 리다이렉트 시 웰니스 섹션 하이라이트
  useEffect(() => {
    if (searchParams.get("highlight") === "wellness") {
      // 마이 솔루션 모달 열기 (home에서 동일한 경험)
      setIsModalOpen(true);
      // URL에서 query param 제거 (히스토리 오염 방지)
      window.history.replaceState(null, "", "/home");
    }
  }, [searchParams]);

  const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // 이미 솔루션을 선택한 고객 → 모달 없이 바로 이동
    const alreadySelected = getSelectedProgram();
    if (alreadySelected && isSelectionConfirmed()) {
      const route = alreadySelected === "autobalance" ? "/wellness/balance" : null;
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
                  src="/assets/images/balance reset_square.png"
                  alt={getProgramName("autobalance")}
                  width={480}
                  height={480}
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
                  src="/assets/images/woman condition_square.png"
                  alt={getProgramName("womans-whisper")}
                  width={480}
                  height={480}
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

          {subscribedProgram ? (
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
          ) : (
            /* ── 미결제: 무료 체험 CTA ── */
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
        <section className={styles.carouselSection}>
          <div
            className={styles.carouselTrack}
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {WELLNESS_SLIDES.map((slide, i) => (
              <Link
                key={slide.href}
                href={slide.href}
                className={styles.carouselCard}
                onClick={handleCardClick}
                draggable={false}
              >
                <div className={styles.carouselImageWrap}>
                  <Image
                    src={slide.image}
                    alt={slide.alt}
                    width={1024}
                    height={1024}
                    className={styles.carouselImage}
                  />
                  <div className={styles.carouselOverlay}>
                    <p className={styles.carouselDesc}>{slide.desc}</p>
                  </div>
                </div>
                <p className={styles.carouselLabel}>{slide.label}</p>
              </Link>
            ))}
          </div>

          {/* Dot indicator */}
          <div className={styles.carouselDots}>
            {WELLNESS_SLIDES.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${
                  activeSlide === i ? styles.dotActive : ""
                }`}
                onClick={() => scrollToSlide(i)}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>
        </section>
      </main>

      <div className={styles.tabPadding}></div>

      <BottomTab />

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.modalBadge}>7일 무료 체험</span>
            <p className={styles.modalTitle}>나에게 맞는 웰니스를 선택하세요</p>
            <p className={styles.modalSubText}>선택 즉시 맞춤 프로그램이 시작됩니다</p>

            <div className={styles.modalCards}>
              <button
                className={styles.modalCard}
                onClick={() => {
                  syncProgramSelection("autobalance");
                  setIsModalOpen(false);
                  router.push("/wellness/balance");
                }}
              >
                <div className={styles.modalCardImageWrap}>
                  <Image
                    src="/assets/images/balance reset_square.png"
                    alt={getProgramName("autobalance")}
                    width={320}
                    height={213}
                    className={styles.modalCardImage}
                  />
                </div>
                <span className={styles.modalCardName}>{getProgramName("autobalance")}</span>
                <span className={styles.modalCardCta}>시작하기 →</span>
              </button>

              <button
                className={styles.modalCard}
                onClick={() => {
                  setIsModalOpen(false);
                  setShowComingSoon(true);
                }}
              >
                <div className={styles.modalCardImageWrap}>
                  <Image
                    src="/assets/images/woman condition_square.png"
                    alt={getProgramName("womans-whisper")}
                    width={320}
                    height={213}
                    className={styles.modalCardImage}
                  />
                </div>
                <span className={styles.modalCardName}>
                  {getProgramName("womans-whisper")}
                </span>
                <span className={styles.modalCardCta}>시작하기 →</span>
              </button>
            </div>
          </div>
        </div>
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
