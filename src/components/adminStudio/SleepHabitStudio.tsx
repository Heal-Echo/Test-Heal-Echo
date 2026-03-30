// components/adminStudio/SleepHabitStudio.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  listWeeklyHabitContent,
  getSleepHabitContent,
  saveSleepHabitContent,
  deleteSleepHabitContent,
} from "@/api/client";
import "@/components/adminStudio/intro.css";

type Row = {
  id: string;
  weekNumber: number;
  habit: string;
  saved: boolean;      // 서버에 저장된 상태인지
  saving: boolean;
};

type Props = {
  folder: string; // e.g. "weekly-habit/autobalance"
};

let rowIdCounter = 0;
function nextRowId() {
  return `row-${++rowIdCounter}-${Date.now()}`;
}

export default function SleepHabitStudio({ folder }: Props) {
  const program = useMemo(() => folder.split("/").pop()!, [folder]);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [loading, setLoading] = useState(true);

  // 위클리 솔루션 주차 수 가져오기
  useEffect(() => {
    async function fetchWeekCount() {
      try {
        const { items } = await listWeeklyHabitContent(program);
        const maxWeek = items.reduce(
          (max, item) => Math.max(max, item.weekNumber),
          0
        );
        setTotalWeeks(Math.max(maxWeek, 1));
      } catch (err) {
        console.error("Failed to get week count:", err);
        setTotalWeeks(8);
      }
    }
    fetchWeekCount();
  }, [program]);

  // 기존 데이터 로드
  useEffect(() => {
    if (totalWeeks === 0) return;

    async function fetchAll() {
      setLoading(true);
      const loaded: Row[] = [];

      for (let w = 1; w <= totalWeeks; w++) {
        try {
          const { item } = await getSleepHabitContent(program, w);
          const habits: string[] = item?.habits ?? [];
          for (const h of habits) {
            loaded.push({
              id: nextRowId(),
              weekNumber: w,
              habit: h,
              saved: true,
              saving: false,
            });
          }
        } catch {
          // 해당 주차에 데이터 없음 — 무시
        }
      }

      setRows(loaded);
      setLoading(false);
    }

    fetchAll();
  }, [program, totalWeeks]);

  // 새 행 추가
  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: nextRowId(),
        weekNumber: 1,
        habit: "",
        saved: false,
        saving: false,
      },
    ]);
  }

  // 행 필드 수정
  function updateRow(id: string, field: "weekNumber" | "habit", value: string | number) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: value, saved: field === "habit" ? false : r.saved }
          : r
      )
    );
  }

  // 행 저장: 해당 주차의 모든 습관을 수집하여 한 번에 PUT
  async function saveRow(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target || !target.habit.trim()) {
      alert("습관 텍스트를 입력해주세요.");
      return;
    }

    // 같은 주차의 모든 습관 수집 (현재 행 포함)
    const weekHabits = rows
      .filter((r) => r.weekNumber === target.weekNumber && r.habit.trim())
      .map((r) => r.habit.trim());

    // 중복 제거
    const unique = [...new Set(weekHabits)];

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, saving: true } : r))
    );

    try {
      await saveSleepHabitContent(program, target.weekNumber, {
        habits: unique,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, saved: true, saving: false } : r
        )
      );
    } catch (err) {
      console.error("Failed to save:", err);
      alert("저장 중 오류가 발생했습니다.");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, saving: false } : r))
      );
    }
  }

  // 행 삭제: 서버에서도 해당 습관 제거
  async function deleteRow(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;

    if (target.saved) {
      // 서버에서 해당 주차의 습관 목록에서 제거
      const weekHabits = rows
        .filter(
          (r) =>
            r.weekNumber === target.weekNumber &&
            r.id !== id &&
            r.habit.trim()
        )
        .map((r) => r.habit.trim());

      const unique = [...new Set(weekHabits)];

      try {
        if (unique.length > 0) {
          await saveSleepHabitContent(program, target.weekNumber, {
            habits: unique,
          });
        } else {
          await deleteSleepHabitContent(program, target.weekNumber);
        }
      } catch (err) {
        console.error("Failed to delete:", err);
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // 드롭다운 옵션 (1 ~ totalWeeks)
  const weekOptions = Array.from({ length: Math.max(totalWeeks, 1) }, (_, i) => i + 1);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 8,
          color: "#1e293b",
        }}
      >
        수면 습관 관리
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "#64748b",
          marginBottom: 24,
        }}
      >
        주차별 수면 습관을 등록하면, 고객에게 누적으로 표시됩니다. (예: 2주차
        고객 = 1주차 + 2주차 습관)
      </p>

      {/* 테이블 */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          background: "#fff",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        <thead>
          <tr
            style={{
              background: "#f8fafc",
              borderBottom: "2px solid #e2e8f0",
            }}
          >
            <th
              style={{
                padding: "12px 16px",
                textAlign: "left",
                fontWeight: 700,
                color: "#334155",
                width: 130,
              }}
            >
              주차
            </th>
            <th
              style={{
                padding: "12px 16px",
                textAlign: "left",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              수면 습관
            </th>
            <th
              style={{
                padding: "12px 16px",
                textAlign: "center",
                fontWeight: 700,
                color: "#334155",
                width: 140,
              }}
            >
              관리
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                등록된 수면 습관이 없습니다. 아래 &quot;+ 새 행 추가&quot; 버튼을
                눌러 추가하세요.
              </td>
            </tr>
          )}

          {rows.map((row) => (
            <tr
              key={row.id}
              style={{
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              {/* 주차 선택 (드롭다운 선택 또는 직접 입력) */}
              <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                <div style={{ position: "relative", width: 100 }}>
                  <input
                    type="number"
                    min={1}
                    value={row.weekNumber}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v > 0) updateRow(row.id, "weekNumber", v);
                    }}
                    disabled={row.saving}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      padding: "8px 36px 8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      color: "#334155",
                      background: "#fff",
                      appearance: "textfield",
                      MozAppearance: "textfield" as any,
                    }}
                  />
                  {/* 주차 라벨 */}
                  <span
                    style={{
                      position: "absolute",
                      right: 32,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 12,
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  >
                    주차
                  </span>
                  {/* 드롭다운 트리거 */}
                  <select
                    value={row.weekNumber}
                    onChange={(e) =>
                      updateRow(row.id, "weekNumber", Number(e.target.value))
                    }
                    disabled={row.saving}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: row.saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {weekOptions.map((w) => (
                      <option key={w} value={w}>
                        {w}주차
                      </option>
                    ))}
                  </select>
                </div>
              </td>

              {/* 습관 텍스트 */}
              <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                <input
                  type="text"
                  value={row.habit}
                  onChange={(e) => updateRow(row.id, "habit", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRow(row.id);
                  }}
                  disabled={row.saving}
                  placeholder="수면 습관을 입력하세요"
                  style={{
                    width: "100%",
                    fontSize: 13,
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    outline: "none",
                    color: "#334155",
                    background: row.saved ? "#f0fdf4" : "#fff",
                  }}
                />
                {row.saved && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#16a34a",
                      marginLeft: 8,
                    }}
                  >
                    ✓ 저장됨
                  </span>
                )}
              </td>

              {/* 저장/삭제 버튼 */}
              <td
                style={{
                  padding: "10px 16px",
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  <button
                    onClick={() => saveRow(row.id)}
                    disabled={row.saving || !row.habit.trim()}
                    style={{
                      border: "none",
                      background:
                        row.saving || !row.habit.trim()
                          ? "#e2e8f0"
                          : "#1e293b",
                      color:
                        row.saving || !row.habit.trim()
                          ? "#94a3b8"
                          : "#fff",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor:
                        row.saving || !row.habit.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {row.saving ? "저장 중…" : "저장"}
                  </button>
                  <button
                    onClick={() => deleteRow(row.id)}
                    disabled={row.saving}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fff",
                      color: "#ef4444",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: row.saving ? "not-allowed" : "pointer",
                    }}
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 새 행 추가 버튼 */}
      <button
        onClick={addRow}
        style={{
          marginTop: 16,
          border: "1px dashed #cbd5e1",
          background: "transparent",
          color: "#64748b",
          borderRadius: 8,
          padding: "10px 0",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        + 새 행 추가
      </button>
    </div>
  );
}
