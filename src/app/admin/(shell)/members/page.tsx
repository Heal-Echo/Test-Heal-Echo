"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProgramName } from "@/config/programs";

/* ─── 타입 ─── */
type UserItem = {
  userId: string;
  name?: string;
  email?: string;
  subscriptionType?: string;
  status?: string;
  subscriptionStatus?: string;
  programId?: string;
  createdAt?: string;
  lastLoginAt?: string;
  wellnessGoal?: string;
  profileSetupDone?: boolean;
};

/* ─── 고객 유형 라벨 ─── */
const TYPE_LABEL: Record<string, string> = {
  browser: "둘러보기",
  browser_selected: "둘러보기(선택)",
  free_trial: "무료 체험",
  paid: "유료",
  free_stopped: "무료 후 중지",
  paid_stopped: "유료 후 중지",
};

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  cancelled: "해지",
};

const GOAL_LABEL: Record<string, string> = {
  "auto-balance": "오토밸런스",
  "womens-care": "우먼즈 케어",
  "healing-mind": "힐링 마인드",
};

/* ─── 스타일 ─── */
const styles = {
  container: {
    padding: "32px 40px",
    maxWidth: 1200,
    fontFamily: "NotoSans, sans-serif",
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111",
  } as React.CSSProperties,

  controls: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  } as React.CSSProperties,

  searchInput: {
    padding: "8px 14px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    width: 240,
    outline: "none",
  } as React.CSSProperties,

  filterSelect: {
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    outline: "none",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
    tableLayout: "auto" as const,
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    padding: "12px 16px",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    color: "#374151",
    backgroundColor: "#f9fafb",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "12px 16px",
    borderBottom: "1px solid #f3f4f6",
    color: "#111",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  row: {
    cursor: "pointer",
    transition: "background 0.15s",
  } as React.CSSProperties,

  badge: (type: string) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background:
      type === "paid"
        ? "#dbeafe"
        : type === "free_trial"
          ? "#fef3c7"
          : type === "free_stopped" || type === "paid_stopped"
            ? "#fee2e2"
            : type === "browser_selected"
              ? "#e0f2fe"
              : "#f3f4f6",
    color:
      type === "paid"
        ? "#1d4ed8"
        : type === "free_trial"
          ? "#92400e"
          : type === "free_stopped" || type === "paid_stopped"
            ? "#991b1b"
            : type === "browser_selected"
              ? "#0369a1"
              : "#6b7280",
  }),

  statusBadge: (status: string) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: status === "active" ? "#d1fae5" : status === "paused" ? "#fef3c7" : "#fee2e2",
    color: status === "active" ? "#065f46" : status === "paused" ? "#92400e" : "#991b1b",
  }),

  goalBadge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: "#eef2ff",
    color: "#4338ca",
  } as React.CSSProperties,

  profileBadge: (done: boolean) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: done ? "#d1fae5" : "#f3f4f6",
    color: done ? "#065f46" : "#9ca3af",
  }),

  empty: {
    textAlign: "center" as const,
    padding: "60px 0",
    color: "#9ca3af",
    fontSize: 15,
  } as React.CSSProperties,

  loadMoreBtn: {
    display: "block",
    margin: "24px auto",
    padding: "10px 32px",
    fontSize: 14,
    fontWeight: 600,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  } as React.CSSProperties,

  count: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  } as React.CSSProperties,
};

export default function MembersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [lastKey, setLastKey] = useState<string | null>(null);

  /* ─── 데이터 조회 ─── */
  const fetchUsers = useCallback(
    async (append = false) => {
      try {
        if (!append) setLoading(true);

        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (typeFilter) params.set("type", typeFilter);
        params.set("limit", "20");
        if (append && lastKey) params.set("lastKey", lastKey);

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        const items: UserItem[] = data.items || [];

        if (append) {
          setUsers((prev) => [...prev, ...items]);
        } else {
          setUsers(items);
        }

        setLastKey(data.lastKey || null);
      } catch (err) {
        console.error("[Members] fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter, lastKey]
  );

  // 초기 로드 + 필터/검색 변경 시
  useEffect(() => {
    const timer = setTimeout(() => {
      setLastKey(null);
      fetchUsers(false);
    }, 300); // 디바운스

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter]);

  /* ─── 날짜 포맷 ─── */
  const fmtDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <h1 style={styles.title}>회원 관리</h1>
        <div style={styles.controls}>
          <select
            style={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">전체 유형</option>
            <option value="browser">둘러보기</option>
            <option value="browser_selected">둘러보기(선택)</option>
            <option value="free_trial">무료 체험</option>
            <option value="paid">유료</option>
            <option value="free_stopped">무료 후 중지</option>
            <option value="paid_stopped">유료 후 중지</option>
          </select>
          <input
            type="text"
            placeholder="이름 또는 이메일 검색"
            style={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p style={styles.count}>{loading ? "불러오는 중..." : `${users.length}명 표시 중`}</p>

      {/* 테이블 */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>이름</th>
            <th style={styles.th}>이메일</th>
            <th style={styles.th}>케어</th>
            <th style={styles.th}>프로필</th>
            <th style={styles.th}>유형</th>
            <th style={styles.th}>프로그램</th>
            <th style={styles.th}>가입일</th>
            <th style={styles.th}>마지막 접속</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.userId}
              style={styles.row}
              onClick={() => router.push(`/admin/members/${u.userId}`)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <td style={styles.td}>{u.name || "-"}</td>
              <td style={styles.td}>{u.email || "-"}</td>
              <td style={styles.td}>
                {u.wellnessGoal ? (
                  <span style={styles.goalBadge}>
                    {GOAL_LABEL[u.wellnessGoal] || u.wellnessGoal}
                  </span>
                ) : (
                  <span style={{ color: "#d1d5db" }}>-</span>
                )}
              </td>
              <td style={styles.td}>
                <span style={styles.profileBadge(!!u.profileSetupDone)}>
                  {u.profileSetupDone ? "완료" : "미완료"}
                </span>
              </td>
              <td style={styles.td}>
                <span style={styles.badge(u.subscriptionType || "browser")}>
                  {TYPE_LABEL[u.subscriptionType || "browser"] || u.subscriptionType}
                </span>
              </td>
              <td style={styles.td}>{getProgramName(u.programId)}</td>
              <td style={styles.td}>{fmtDate(u.createdAt)}</td>
              <td style={styles.td}>{fmtDate(u.lastLoginAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 빈 상태 */}
      {!loading && users.length === 0 && (
        <div style={styles.empty}>
          {search || typeFilter ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}
        </div>
      )}

      {/* 더 보기 */}
      {lastKey && !loading && (
        <button style={styles.loadMoreBtn} onClick={() => fetchUsers(true)}>
          더 보기
        </button>
      )}
    </div>
  );
}
