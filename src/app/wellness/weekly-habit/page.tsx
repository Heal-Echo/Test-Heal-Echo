// src/app/wellness/weekly-habit/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./weeklyHabit.module.css";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import ComingSoonModal from "@/components/publicSite/coming-soon-modal";

import { isUserLoggedIn } from "@/auth/user";
import { makeVideoUrl } from "@/config/constants";
import { PROGRAMS_LIST } from "@/config/programs";
import * as storage from "@/lib/storage";
import {
  getSelectedProgram,
  isSelectionConfirmed,
  isChangeUsed as isChangeUsedFromStore,
  syncProgramSelection,
  hydrateFromAWS,
  PROGRAM_START_KEY,
} from "@/lib/program-selection";

import CollapsibleVideoSection from "@/components/weekly-habit/collapsible-video-section";
import PSQITest from "@/components/weekly-habit/psqi-test";

type HabitItem = {
  name: string;
  description: string;
};

type WeeklyHabitData = {
  program: string;
  weekNumber: number;
  videoKey: string | null;
  thumbnailKey: string | null;
  habitTitle: string;
  habitDescription: string;
  habitItems: HabitItem[];
  isPublished: boolean;
};

// 스토리지 키: PROGRAM_START_KEY는 programSelection.ts에서 import

/** 프로그램 시작일 기준 현재 주차 번호 (1-based) — CollapsibleVideoSection과 동일 로직 */
function getCurrentWeekNumber(): number {
  if (typeof window === "undefined") return 1;
  try {
    storage.migrateKey(PROGRAM_START_KEY);
    let startStr = storage.get(PROGRAM_START_KEY);
    if (!startStr) {
      startStr = new Date().toISOString().split("T")[0];
      storage.set(PROGRAM_START_KEY, startStr);
    }
    const start = new Date(startStr + "T00:00:00");
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  } catch {
    return 1;
  }
}

// 위클리 해빗 전용 설명 (솔루션 페이지와 다른 맥락)
const HABIT_DESC: Record<string, string> = {
  autobalance: "자율신경계 균형을 되찾는 수면·이완 습관",
  "womans-whisper": "여성 건강을 위한 호르몬 밸런스 습관",
};

// ── 팝업 상태 타입 ──
type PopupState =
  | "none" // 팝업 없음 → 콘텐츠 표시
  | "select" // 신규: 솔루션 선택 (2개 카드)
  | "confirm" // 기존: "○○○으로 계속합니다." 예/아니오
  | "change"; // "아니오" 또는 뱃지 클릭 → 1회 변경 선택

// getSavedProgram, isProgramConfirmed, isChangeUsed → programSelection.ts 통합 함수 사용

export default function WeeklyHabitPage() {
  const router = useRouter();
  const [weekNumber] = useState(() => getCurrentWeekNumber());
  const [program, setProgram] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupState>("none");
  const [changeUsed, setChangeUsed] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeeklyHabitData | null>(null);

  // 기존 PSQI 결과 (이미 완료한 경우 결과 화면 바로 표시)
  const [existingPSQI, setExistingPSQI] = useState<{
    total: number;
    components: Record<string, number>;
    efficiency: number;
  } | null>(null);
  const [psqiChecked, setPsqiChecked] = useState(false);

  // 관리자 수면 습관 (누적)
  const [adminHabits, setAdminHabits] = useState<string[]>([]);

  // 로그인 확인
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // 마운트 시: 통합 함수로 확인 → AWS hydrate → 팝업 분기
  useEffect(() => {
    async function initPreferences() {
      // 1) 로컬 + subscription 캐시에서 통합 확인
      let saved = getSelectedProgram();
      let confirmed = isSelectionConfirmed();
      const used = isChangeUsedFromStore();
      setChangeUsed(used);

      // 2) 로컬에 없으면 AWS에서 hydrate 시도
      if (!saved) {
        const hydrated = await hydrateFromAWS();
        if (hydrated) {
          saved = hydrated;
          confirmed = isSelectionConfirmed();
          setChangeUsed(isChangeUsedFromStore());
        }
      }

      // 3) 팝업 분기
      if (!saved) {
        setPopup("select");
      } else if (!confirmed) {
        setProgram(saved);
        setPopup("confirm");
      } else {
        setProgram(saved);
        setPopup("none");
      }
    }

    initPreferences();
  }, []);

  // ── 신규: 솔루션 선택 ──
  function handleSelectProgram(programId: string) {
    // "우먼즈 컨디션 케어" 선택 시 ComingSoon 표시
    if (programId === "womans-whisper") {
      setShowComingSoon(true);
      return;
    }

    // 통합 함수: 모든 저장소에 동시 기록 + AWS 비동기 저장
    syncProgramSelection(programId);

    setProgram(programId);
    setPopup("none");
  }

  // ── 기존: "예" → 계속 진행 ──
  function handleConfirmYes() {
    // program이 이미 있으므로 syncProgramSelection으로 확정 기록
    if (program) {
      syncProgramSelection(program);
    }
    setPopup("none");
  }

  // ── 기존: "아니오" → 1회 변경 화면 ──
  function handleConfirmNo() {
    setPopup("change");
  }

  // ── 1회 변경에서 솔루션 선택 ──
  function handleChangeTo(programId: string) {
    // "우먼즈 컨디션 케어" 선택 시 ComingSoon 표시
    if (programId === "womans-whisper") {
      setShowComingSoon(true);
      return;
    }

    // 통합 함수: 모든 저장소에 동시 기록 + 변경 플래그 설정
    syncProgramSelection(programId, { isChange: true });

    setProgram(programId);
    setChangeUsed(true);
    setPopup("none");
  }

  // ── 솔루션 뱃지 클릭 → 변경 가능 여부에 따라 분기 ──
  function handleChangeProgram() {
    if (changeUsed) {
      // 이미 1회 변경을 사용함 → 아무 동작 없음 (또는 안내)
      return;
    }
    setPopup("change");
  }

  // ── ComingSoon 닫기 ──
  function handleComingSoonClose() {
    setShowComingSoon(false);
  }

  // PSQI 스킵 여부
  const [psqiSkipped, setPsqiSkipped] = useState(false);

  // 기존 PSQI 결과 확인 → 미완료 시 /wellness/psqi로 리다이렉트
  useEffect(() => {
    if (!program || popup !== "none") return;

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
            // 가장 최근 결과
            const latest = results[results.length - 1];
            setExistingPSQI({
              total: latest.total,
              components: latest.components || {},
              efficiency: latest.efficiency || 0,
            });
            // PSQI 완료자: 스킵 플래그 정리
            storage.remove("psqi_skipped");
          } else {
            // PSQI 미완료: 스킵 여부 확인
            const skipped = storage.get("psqi_skipped") === "true";
            if (skipped) {
              setPsqiSkipped(true);
            } else {
              // 스킵한 적 없음 → PSQI 독립 페이지로 리다이렉트
              router.replace("/wellness/psqi");
              return;
            }
          }
        }
      } catch (err) {
        console.error("PSQI 결과 확인 실패:", err);
      } finally {
        setPsqiChecked(true);
      }
    }

    checkExistingPSQI();
  }, [program, popup, router]);

  // 콘텐츠 로드
  useEffect(() => {
    if (!program || popup !== "none") return;

    async function fetchContent() {
      try {
        setLoading(true);
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch(`/api/public/weekly-habit/${program}/${weekNumber}`, {
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });

        if (!res.ok) {
          setData(null);
          return;
        }

        const json = await res.json();
        setData(json.item || null);
      } catch (err) {
        console.error("Failed to load weekly habit content:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [program, weekNumber, popup]);

  // 관리자 수면 습관 로드 (Lambda에서 1~현재 주차 누적 + carry-forward 처리)
  useEffect(() => {
    if (!program || popup !== "none") return;

    async function fetchSleepHabits() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch(`/api/public/sleep-habit/${program}/${weekNumber}`, {
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setAdminHabits(json.item?.habits ?? []);
        } else {
          setAdminHabits([]);
        }
      } catch (err) {
        console.error("Failed to load admin sleep habits:", err);
        setAdminHabits([]);
      }
    }

    fetchSleepHabits();
  }, [program, weekNumber, popup]);

  // PSQI 결과 서버 저장 핸들러
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

  // 선택한 프로그램 이름
  const selectedProgramInfo = PROGRAMS_LIST.find((p) => p.id === program);

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.main}>
        {/* ── 팝업 A: 신규 사용자 — 솔루션 선택 ── */}
        {popup === "select" && (
          <div className={styles.overlay}>
            <div className={styles.modal}>
              <h2 className={styles.modalTitle}>관심있는 웰니스 솔루션을 선택하세요.</h2>
              <p className={styles.modalSub}>1주차 위클리 해빗을 무료로 체험할 수 있어요.</p>

              <div className={styles.programCards}>
                {PROGRAMS_LIST.map((p) => (
                  <button
                    key={p.id}
                    className={styles.programCard}
                    onClick={() => handleSelectProgram(p.id)}
                  >
                    <div className={styles.programImageWrap}>
                      <Image
                        src={p.imageAlt}
                        alt={p.name}
                        width={120}
                        height={120}
                        className={styles.programImage}
                      />
                    </div>
                    <span className={styles.programName}>{p.name}</span>
                    <span className={styles.programDesc}>{HABIT_DESC[p.id] || p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 팝업 B: 기존 사용자 — 계속 확인 ── */}
        {popup === "confirm" && selectedProgramInfo && (
          <div className={styles.overlay}>
            <div className={styles.modal}>
              <div className={styles.confirmImageWrap}>
                <Image
                  src={selectedProgramInfo.imageAlt}
                  alt={selectedProgramInfo.name}
                  width={80}
                  height={80}
                  className={styles.confirmImage}
                />
              </div>
              <h2 className={styles.modalTitle}>{selectedProgramInfo.name}으로 계속합니다.</h2>

              <div className={styles.confirmButtons}>
                <button className={styles.confirmBtnYes} onClick={handleConfirmYes}>
                  예
                </button>
                <button className={styles.confirmBtnNo} onClick={handleConfirmNo}>
                  아니오
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 팝업 C: 솔루션 1회 변경 ── */}
        {popup === "change" && (
          <div className={styles.overlay}>
            <div className={styles.modal}>
              <h2 className={styles.modalTitle}>솔루션 변경은 1회 가능합니다.</h2>
              <p className={styles.modalSub}>변경할 솔루션을 선택하세요.</p>

              <div className={styles.programCards}>
                {PROGRAMS_LIST.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.programCard} ${
                      p.id === program ? styles.programCardCurrent : ""
                    }`}
                    onClick={() => handleChangeTo(p.id)}
                    disabled={p.id === program}
                  >
                    <div className={styles.programImageWrap}>
                      <Image
                        src={p.imageAlt}
                        alt={p.name}
                        width={120}
                        height={120}
                        className={styles.programImage}
                      />
                    </div>
                    <span className={styles.programName}>{p.name}</span>
                    {p.id === program && <span className={styles.currentLabel}>현재 선택</span>}
                    {p.id !== program && (
                      <span className={styles.programDesc}>
                        {HABIT_DESC[p.id] || p.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                className={styles.changeCancelBtn}
                onClick={() => {
                  // 확인 팝업에서 왔으면 confirm으로, 콘텐츠에서 왔으면 none으로
                  const confirmed = isSelectionConfirmed();
                  setPopup(confirmed ? "none" : "confirm");
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 콘텐츠 영역 ── */}
        {popup === "none" && (
          <>
            {loading ? (
              <div className={styles.loadingContainer}>
                <span className={styles.loadingText}>불러오는 중...</span>
              </div>
            ) : !data ? (
              <div className={styles.emptyContainer}>
                <span className={styles.emptyText}>
                  이번 주 습관 콘텐츠가 아직 준비되지 않았습니다.
                </span>
              </div>
            ) : (
              <>
                {/* 솔루션 뱃지 */}
                <button
                  className={`${styles.programBadge} ${
                    changeUsed ? styles.programBadgeDisabled : ""
                  }`}
                  onClick={handleChangeProgram}
                >
                  {selectedProgramInfo?.name ?? program}
                  {!changeUsed && <span className={styles.programBadgeArrow}>&#8250;</span>}
                </button>

                {/* 주차 배지 + 제목 */}
                <span className={styles.weekBadge}>{data.weekNumber}주차 무료 체험</span>
                <h1 className={styles.title}>{data.habitTitle}</h1>

                {/* 본문: PSQI 수면 품질 자가 진단 */}
                {psqiChecked && (
                  <>
                    {psqiSkipped && !existingPSQI ? (
                      /* PSQI 미완료 + "나중에 하기" 선택한 사용자 */
                      <div className={styles.psqiSkippedCard}>
                        <div className={styles.psqiSkippedIcon}>
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                              stroke="#6366f1"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <p className={styles.psqiSkippedText}>
                          수면의 질 검사를 완료하면
                          <br />
                          맞춤 수면 습관을 시작할 수 있어요.
                        </p>
                        <button
                          className={styles.psqiSkippedBtn}
                          onClick={() => router.push("/wellness/psqi")}
                        >
                          지금 수면의 질 검사하기
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ marginLeft: 6 }}
                          >
                            <path
                              d="M5 12h14M12 5l7 7-7 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      /* PSQI 완료자: 기존 PSQITest (step 2 = miniScoreCard + 수면 기록 + Habit Tracker) */
                      <PSQITest
                        onSubmit={handlePSQISubmit}
                        initialResult={existingPSQI}
                        weekNumber={weekNumber}
                        adminHabits={adminHabits}
                        onViewResult={() => router.push("/wellness/psqi")}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 하단 영상 바 패딩 (핸들 높이 + BottomTab 높이) */}
      <div className={styles.tabPadding} />

      {/* ── 하단 고정: 영상 Bottom Sheet (BottomTab 바로 위) ── */}
      {popup === "none" && data?.videoKey && (
        <CollapsibleVideoSection
          videoUrl={makeVideoUrl(data.videoKey)}
          title={`${data.weekNumber}주차 - ${data.habitTitle}`}
          description={data.habitDescription || undefined}
          weekNumber={weekNumber}
        />
      )}

      <BottomTab />

      {/* 우먼즈 컨디션 케어 Coming Soon 팝업 */}
      <ComingSoonModal open={showComingSoon} onClose={handleComingSoonClose} />
    </div>
  );
}
