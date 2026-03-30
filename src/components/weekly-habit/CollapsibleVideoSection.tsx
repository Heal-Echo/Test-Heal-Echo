// src/components/weekly-habit/CollapsibleVideoSection.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./CollapsibleVideoSection.module.css";
import * as storage from "@/lib/storage";

type Props = {
  videoUrl: string;
  title: string;
  description?: string;
  weekNumber?: number;
};

/* ──────────────────────────────────────────────
   자동 펼침/접힘 로직 (storage 레이어 기반)

   - 솔루션 최초 선택 후 1회: 펼침
   - 이후 방문: 접힘
   - 프로그램 시작일 기준 7일 주기 새 주차 첫 방문: 펼침
   - 같은 주차 두 번째 접속부터: 접힘
   - 매주 첫 날에는 영상 시청 전 접힘(내림) 불가
   ────────────────────────────────────────────── */

const PROGRAM_START_KEY = "weekly_habit_program_start_date";
const LAST_SEEN_WEEK_KEY = "weekly_habit_last_seen_week";
const FIRST_VISIT_KEY = "weekly_habit_first_visit_done";

/** 프로그램 시작일 기준 현재 주차 번호 (1-based) */
function getCurrentWeekNumber(): number {
  if (typeof window === "undefined") return 1;
  try {
    storage.migrateKey(PROGRAM_START_KEY);
    let startStr = storage.get(PROGRAM_START_KEY);
    if (!startStr) {
      // 시작일이 없으면 오늘을 시작일로 저장
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

/** 오늘이 1주차 1일(무료 체험 시작일)인지 판단 */
function isFirstDayOfTrial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const startStr = storage.get(PROGRAM_START_KEY);
    if (!startStr) return true; // 시작일 자체가 없으면 오늘이 첫날
    const start = new Date(startStr + "T00:00:00");
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays === 0; // 프로그램 시작 당일(1주차 1일)만
  } catch {
    return false;
  }
}

/** 자동 펼침 여부 판단 */
function shouldAutoExpand(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // 1) 최초 방문 (한 번도 본 적 없음)
    storage.migrateKey(FIRST_VISIT_KEY);
    const firstDone = storage.get(FIRST_VISIT_KEY);
    if (!firstDone) {
      return true;
    }

    // 2) 새 주차 첫 방문
    const currentWeek = getCurrentWeekNumber();
    storage.migrateKey(LAST_SEEN_WEEK_KEY);
    const lastSeen = storage.get(LAST_SEEN_WEEK_KEY);
    const lastSeenWeek = lastSeen ? parseInt(lastSeen, 10) : 0;

    if (currentWeek > lastSeenWeek) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** 펼침 상태를 확인한 것으로 기록 */
function markAsSeen() {
  if (typeof window === "undefined") return;
  storage.set(FIRST_VISIT_KEY, "true");
  const currentWeek = getCurrentWeekNumber();
  storage.set(LAST_SEEN_WEEK_KEY, String(currentWeek));
}

export default function CollapsibleVideoSection({
  videoUrl,
  title,
  description,
  weekNumber,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [firstDay, setFirstDay] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // 마운트 시 자동 펼침 여부 결정
  useEffect(() => {
    const autoExpand = shouldAutoExpand();
    setExpanded(autoExpand);
    setFirstDay(isFirstDayOfTrial());

    // 자동 펼침이면 '확인함'으로 기록
    if (autoExpand) {
      markAsSeen();
    }

    setMounted(true);
  }, []);

  /** 토스트 메시지 표시 */
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  }, []);

  function handleToggle() {
    // 매주 첫 날 + 펼쳐진 상태에서 접으려 할 때 → 차단
    if (firstDay && expanded) {
      showToast("이번 주 영상을 먼저 만나보세요. 영상 속 작은 팁이 이번 주 수면을 바꿔줄 거예요.");
      return;
    }
    setExpanded((prev) => !prev);
  }

  function handleBackdropClick() {
    // 매주 첫 날에는 배경 클릭으로도 접히지 않음
    if (firstDay) {
      showToast("이번 주 영상을 먼저 만나보세요. 영상 속 작은 팁이 이번 주 수면을 바꿔줄 거예요.");
      return;
    }
    setExpanded(false);
  }

  // SSR 시 렌더링 방지
  if (!mounted) return null;

  return (
    <>
      {/* 펼침 시 뒤쪽 어두운 오버레이 */}
      {expanded && <div className={styles.backdrop} onClick={handleBackdropClick} />}

      {/* 하단 고정: BottomTab(70px) 바로 위 */}
      <div
        className={`${styles.sheet} ${
          expanded ? styles.sheetExpanded : styles.sheetCollapsed
        }`}
      >
        {/* ── 핸들 바 (항상 보임) ── */}
        <button className={styles.handle} onClick={handleToggle} type="button">
          <span className={styles.handleBar} />
          <div className={styles.handleContent}>
            <span className={styles.handleIcon}>▶</span>
            <span className={styles.handleText}>
              {expanded ? title : weekNumber ? `${weekNumber}주차 영상 보기` : "이번 주 영상 보기"}
            </span>
            <span
              className={`${styles.handleArrow} ${
                expanded ? styles.handleArrowOpen : ""
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M5 7L9 11L13 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </button>

        {/* ── 바디 (영상 + 설명) ── */}
        {expanded && (
          <div className={styles.body}>
            {/* 영상 */}
            <div className={styles.videoWrap}>
              {videoUrl && (
                <video
                  className={styles.video}
                  src={videoUrl}
                  controls
                  controlsList="nodownload"
                  playsInline
                  preload="metadata"
                />
              )}
            </div>

            {/* 설명 (영상 아래) */}
            {description && (
              <div className={styles.descriptionArea}>
                <p className={styles.descriptionText}>{description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 토스트 메시지 ── */}
      {toastMsg && (
        <div className={`${styles.toast} ${toastVisible ? styles.toastVisible : styles.toastHidden}`}>
          <span className={styles.toastIcon}>🔒</span>
          <span className={styles.toastText}>{toastMsg}</span>
        </div>
      )}
    </>
  );
}
