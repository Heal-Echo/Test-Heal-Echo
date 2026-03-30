// src/components/weekly-habit/HabitTracker.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./HabitTracker.module.css";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

type HabitItemType = {
  name: string;
  description: string;
};

type TrackingRecord = {
  userId: string;
  trackingKey: string;
  program: string;
  weekNumber: number;
  date: string;
  checkedItems: Record<string, boolean>;
};

type Props = {
  habits: HabitItemType[];
  weekNumber: number;
  program: string;
};

// 이번 주 월~일 날짜 배열 생성
function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일, 1=월, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // 이번 주 월요일

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

function getTodayStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function HabitTracker({ habits, weekNumber, program }: Props) {
  const weekDates = getWeekDates();
  const today = getTodayStr();

  // checkedMap: { "YYYY-MM-DD": { "0": true, "1": false, ... } }
  const [checkedMap, setCheckedMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [saving, setSaving] = useState(false);

  // 기존 체크 기록 로드
  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/user/habit-tracking/${weekNumber}?program=${program}`
      );
      if (!res.ok) return;
      const data = await res.json();

      const map: Record<string, Record<string, boolean>> = {};
      for (const record of data.items || []) {
        if (record.date && record.checkedItems) {
          map[record.date] = record.checkedItems;
        }
      }
      setCheckedMap(map);
    } catch (err) {
      console.error("Failed to load habit tracking records:", err);
    }
  }, [weekNumber, program]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 체크 토글
  async function handleCheck(date: string, habitIndex: number) {
    // 미래 날짜는 체크 불가
    if (date > today) return;

    const currentChecked = checkedMap[date]?.[String(habitIndex)] ?? false;
    const newChecked = !currentChecked;

    // 낙관적 업데이트
    setCheckedMap((prev) => {
      const updated = {
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [String(habitIndex)]: newChecked,
        },
      };

      // AWS에 실천 기록 저장
      if (newChecked) {
        const token = storage.getRaw("user_id_token");
        fetch("/api/user/practice-record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type: "habit", date }),
        }).catch(() => {});
      }

      return updated;
    });

    // 서버 저장
    try {
      setSaving(true);
      const userToken = storage.getRaw("user_id_token");
      await fetch("/api/user/habit-tracking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        },
        body: JSON.stringify({
          program,
          weekNumber,
          date,
          habitIndex,
          checked: newChecked,
        }),
      });
    } catch (err) {
      console.error("Failed to save habit check:", err);
      // 실패 시 롤백
      setCheckedMap((prev) => ({
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [String(habitIndex)]: currentChecked,
        },
      }));
    } finally {
      setSaving(false);
    }
  }

  // 주간 완료율 계산
  const totalCells = habits.length * 7;
  let checkedCount = 0;
  for (const date of weekDates) {
    if (date > today) continue; // 미래 날짜 제외
    for (let i = 0; i < habits.length; i++) {
      if (checkedMap[date]?.[String(i)]) checkedCount++;
    }
  }
  // 오늘까지 가능한 셀 수
  const todayIdx = weekDates.indexOf(today);
  const availableCells =
    todayIdx >= 0 ? habits.length * (todayIdx + 1) : totalCells;
  const completionRate =
    availableCells > 0 ? Math.round((checkedCount / availableCells) * 100) : 0;

  return (
    <div className={styles.wrapper}>
      {/* 주간 완료율 */}
      <div className={styles.progressSection}>
        <span className={styles.progressText}>
          이번 주 달성률
          <span className={styles.progressPercent}>{completionRate}%</span>
        </span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className={styles.dayHeaders}>
        <span className={styles.habitNameHeader}>습관</span>
        {weekDates.map((date, idx) => (
          <span
            key={date}
            className={`${styles.dayHeaderLabel} ${
              date === today ? styles.dayHeaderToday : ""
            }`}
          >
            {DAY_LABELS[idx]}
          </span>
        ))}
      </div>

      {/* 습관 행 */}
      {habits.map((habit, habitIdx) => (
        <div key={habitIdx} className={styles.habitRow}>
          <span className={styles.habitName} title={habit.description}>
            {habit.name}
          </span>
          {weekDates.map((date) => {
            const isChecked =
              checkedMap[date]?.[String(habitIdx)] ?? false;
            const isFuture = date > today;
            const isToday = date === today;

            return (
              <div key={date} className={styles.checkCell}>
                <div
                  className={`${styles.checkBox} ${
                    isChecked ? styles.checkBoxChecked : ""
                  } ${isToday ? styles.checkBoxToday : ""} ${
                    isFuture ? styles.checkBoxDisabled : ""
                  }`}
                  onClick={() => !isFuture && handleCheck(date, habitIdx)}
                >
                  {isChecked ? "✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
