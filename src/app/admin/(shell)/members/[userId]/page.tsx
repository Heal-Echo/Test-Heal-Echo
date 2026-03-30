"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getProgramName } from "@/config/programs";

/* ─── 타입 ─── */
type UserDetail = {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  subscriptionType?: string;
  status?: string;
  startDate?: string;
  currentWeek?: number;
  createdAt?: string;
  lastLoginAt?: string;
  adminMemo?: string;
  // 프로필 온보딩 필드
  wellnessGoal?: string;
  dietHabit?: string;
  sleepHabit?: string;
  experience?: string;
  nickname?: string;
  birthDate?: string;
  gender?: string;
  pushNotification?: boolean;
  emailNotification?: boolean;
  termsConsent?: boolean;
  termsConsentAt?: string;
  marketingConsent?: boolean;
  marketingConsentAt?: string;
  profileSetupDone?: boolean;
  profileUpdatedAt?: string;
};

type WatchRecord = {
  userId: string;
  watchDate: string;
  programId?: string;
  weekNumber?: number;
  isCompleted?: boolean;
  watchDuration?: number;
};

const TYPE_OPTIONS = [
  { value: "browser", label: "둘러보기" },
  { value: "browser_selected", label: "둘러보기(선택)" },
  { value: "free_trial", label: "무료 체험" },
  { value: "paid", label: "유료" },
  { value: "free_stopped", label: "무료 후 중지" },
  { value: "paid_stopped", label: "유료 후 중지" },
];

/* ─── 프로필 값 → 한글 매핑 ─── */
const GOAL_LABEL: Record<string, string> = {
  "auto-balance": "기적의 오토 밸런스",
  "womens-care": "우먼즈 컨디션 케어",
  "healing-mind": "힐링 마인드",
};
const DIET_LABEL: Record<string, string> = {
  practicing: "꾸준히 실천 중",
  interested: "관심은 있지만 아직",
  "not-yet": "아직 신경 쓰지 못함",
};
const SLEEP_LABEL: Record<string, string> = {
  practicing: "꾸준히 실천 중",
  interested: "관심은 있지만 아직",
  "not-yet": "아직 신경 쓰지 못함",
};
const EXP_LABEL: Record<string, string> = {
  beginner: "처음이에요",
  casual: "가끔 해봤어요",
  regular: "꾸준히 하고 있어요",
};
const GENDER_LABEL: Record<string, string> = {
  female: "여성",
  male: "남성",
  other: "기타",
};

const STATUS_OPTIONS = [
  { value: "active", label: "활성" },
  { value: "paused", label: "일시정지" },
  { value: "cancelled", label: "해지" },
];

/* ─── 스타일 ─── */
const s = {
  container: {
    padding: "32px 40px",
    maxWidth: 900,
    fontFamily: "NotoSans, sans-serif",
  } as React.CSSProperties,

  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "#6b7280",
    cursor: "pointer",
    marginBottom: 20,
    background: "none",
    border: "none",
    padding: 0,
  } as React.CSSProperties,

  section: {
    marginBottom: 32,
    padding: "24px 28px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
    marginBottom: 18,
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "12px 16px",
    fontSize: 14,
  } as React.CSSProperties,

  label: {
    color: "#6b7280",
    fontWeight: 500,
  } as React.CSSProperties,

  value: {
    color: "#111",
    fontWeight: 400,
  } as React.CSSProperties,

  select: {
    padding: "6px 10px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    outline: "none",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    minHeight: 80,
    padding: "10px 14px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "NotoSans, sans-serif",
  } as React.CSSProperties,

  saveBtn: {
    marginTop: 16,
    padding: "10px 28px",
    fontSize: 14,
    fontWeight: 600,
    background: "#1e293b",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  } as React.CSSProperties,

  savedMsg: {
    display: "inline-block",
    marginLeft: 12,
    fontSize: 13,
    color: "#059669",
    fontWeight: 500,
  } as React.CSSProperties,

  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    maxWidth: 350,
  } as React.CSSProperties,

  calDay: (isCompleted: boolean, isToday: boolean) => ({
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    fontSize: 13,
    fontWeight: isToday ? 700 : 400,
    background: isCompleted ? "#1e293b" : "transparent",
    color: isCompleted ? "#fff" : isToday ? "#1d4ed8" : "#374151",
    border: isToday && !isCompleted ? "2px solid #1d4ed8" : "none",
  }),

  calWeekday: {
    width: 40,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: 600,
  } as React.CSSProperties,

  recordTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  } as React.CSSProperties,

  rth: {
    textAlign: "left" as const,
    padding: "8px 12px",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    color: "#374151",
    backgroundColor: "#f9fafb",
  } as React.CSSProperties,

  rtd: {
    padding: "8px 12px",
    borderBottom: "1px solid #f3f4f6",
    color: "#111",
  } as React.CSSProperties,

  onBadge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: "#d1fae5",
    color: "#065f46",
  } as React.CSSProperties,

  offBadge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: "#f3f4f6",
    color: "#9ca3af",
  } as React.CSSProperties,

  profileGrid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 140px 1fr",
    gap: "12px 16px",
    fontSize: 14,
  } as React.CSSProperties,
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [watchRecords, setWatchRecords] = useState<WatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 수정 가능한 필드
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editMemo, setEditMemo] = useState("");

  /* ─── 데이터 로드 ─── */
  useEffect(() => {
    if (!userId) return;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/users/${userId}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to fetch user");

        const data = await res.json();
        setUser(data.user || null);
        setWatchRecords(data.watchRecords || []);

        if (data.user) {
          setEditType(data.user.subscriptionType || "browser");
          setEditStatus(data.user.status || "active");
          setEditMemo(data.user.adminMemo || "");
        }
      } catch (err) {
        console.error("[MemberDetail] load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  /* ─── 저장 ─── */
  const handleSave = useCallback(async () => {
    if (!userId || saving) return;

    try {
      setSaving(true);
      setSaved(false);

      const body: Record<string, any> = {};
      if (editType !== user?.subscriptionType) body.subscriptionType = editType;
      if (editStatus !== user?.status) body.status = editStatus;
      if (editMemo !== (user?.adminMemo || "")) body.adminMemo = editMemo;

      if (Object.keys(body).length === 0) {
        setSaved(true);
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      if (data.user) setUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("[MemberDetail] save error:", err);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [userId, editType, editStatus, editMemo, user, saving]);

  /* ─── 회원 삭제 ─── */
  const handleDelete = useCallback(async () => {
    if (!userId || deleting) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete user");

      alert("회원이 삭제되었습니다.");
      router.push("/admin/members");
    } catch (err) {
      console.error("[MemberDetail] delete error:", err);
      alert("회원 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }, [userId, deleting, router]);

  /* ─── 날짜 포맷 ─── */
  const fmtDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ─── 시청 달력 (현재 월) ─── */
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const todayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const completedDates = new Set(
    watchRecords.filter((r) => r.isCompleted).map((r) => r.watchDate)
  );

  if (loading) {
    return (
      <div style={s.container}>
        <p style={{ color: "#9ca3af" }}>불러오는 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={s.container}>
        <button style={s.backBtn} onClick={() => router.push("/admin/members")}>
          ← 목록으로
        </button>
        <p style={{ color: "#ef4444" }}>회원 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <button style={s.backBtn} onClick={() => router.push("/admin/members")}>
        ← 회원 목록
      </button>

      {/* ── 기본 정보 ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>기본 정보</h2>
        <div style={s.grid}>
          <span style={s.label}>이름</span>
          <span style={s.value}>{user.name || "-"}</span>

          <span style={s.label}>이메일</span>
          <span style={s.value}>{user.email || "-"}</span>

          <span style={s.label}>전화번호</span>
          <span style={s.value}>{user.phone || "-"}</span>

          <span style={s.label}>가입일</span>
          <span style={s.value}>{fmtDate(user.createdAt)}</span>

          <span style={s.label}>마지막 접속</span>
          <span style={s.value}>{fmtDate(user.lastLoginAt)}</span>
        </div>
      </div>

      {/* ── 동의 정보 ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>동의 정보</h2>
        <div style={s.grid}>
          <span style={s.label}>이용약관 동의</span>
          <span>
            {user.termsConsent ? <span style={s.onBadge}>동의</span> : <span style={s.offBadge}>미동의</span>}
            {user.termsConsentAt && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{fmtDate(user.termsConsentAt)}</span>}
          </span>

          <span style={s.label}>마케팅 동의</span>
          <span>
            {user.marketingConsent ? <span style={s.onBadge}>동의</span> : <span style={s.offBadge}>미동의</span>}
            {user.marketingConsentAt && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{fmtDate(user.marketingConsentAt)}</span>}
          </span>
        </div>
      </div>

      {/* ── 프로필 설정 정보 ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>
          프로필 설정 정보
          {user.profileSetupDone ? (
            <span style={{ ...s.onBadge, marginLeft: 12 }}>완료</span>
          ) : (
            <span style={{ ...s.offBadge, marginLeft: 12 }}>미완료</span>
          )}
        </h2>

        {user.profileSetupDone ? (
          <div style={s.profileGrid}>
            <span style={s.label}>선택한 케어</span>
            <span style={{ ...s.value, fontWeight: 600, color: "#4338ca" }}>
              {GOAL_LABEL[user.wellnessGoal || ""] || user.wellnessGoal || "-"}
            </span>

            <span style={s.label}>닉네임</span>
            <span style={s.value}>{user.nickname || "-"}</span>

            <span style={s.label}>식습관</span>
            <span style={s.value}>
              {DIET_LABEL[user.dietHabit || ""] || user.dietHabit || "-"}
            </span>

            <span style={s.label}>수면습관</span>
            <span style={s.value}>
              {SLEEP_LABEL[user.sleepHabit || ""] || user.sleepHabit || "-"}
            </span>

            <span style={s.label}>경험 수준</span>
            <span style={s.value}>
              {EXP_LABEL[user.experience || ""] || user.experience || "-"}
            </span>

            <span style={s.label}>성별</span>
            <span style={s.value}>
              {GENDER_LABEL[user.gender || ""] || user.gender || "-"}
            </span>

            <span style={s.label}>생년월일</span>
            <span style={s.value}>{user.birthDate || "-"}</span>

            <span style={s.label}>프로필 완료일</span>
            <span style={s.value}>{fmtDate(user.profileUpdatedAt)}</span>

            <span style={s.label}>푸시 알림</span>
            <span>{user.pushNotification ? <span style={s.onBadge}>ON</span> : <span style={s.offBadge}>OFF</span>}</span>

            <span style={s.label}>이메일 알림</span>
            <span>{user.emailNotification ? <span style={s.onBadge}>ON</span> : <span style={s.offBadge}>OFF</span>}</span>

          </div>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            아직 프로필 설정을 완료하지 않았습니다.
          </p>
        )}
      </div>

      {/* ── 구독 정보 (수정 가능) ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>구독 관리</h2>
        <div style={s.grid}>
          <span style={s.label}>고객 유형</span>
          <select
            style={s.select}
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <span style={s.label}>계정 상태</span>
          <select
            style={s.select}
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <span style={s.label}>구독 시작일</span>
          <span style={s.value}>{fmtDate(user.startDate)}</span>

          <span style={s.label}>현재 주차</span>
          <span style={s.value}>{user.currentWeek ?? "-"}주차</span>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>관리자 메모</div>
          <textarea
            style={s.textarea}
            value={editMemo}
            onChange={(e) => setEditMemo(e.target.value)}
            placeholder="메모를 입력하세요..."
          />
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            style={{
              ...s.saveBtn,
              opacity: saving ? 0.6 : 1,
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "변경 사항 저장"}
          </button>
          {saved && <span style={s.savedMsg}>저장되었습니다</span>}
        </div>
      </div>

      {/* ── 시청 달력 ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>
          시청 현황 — {calYear}년 {calMonth + 1}월
        </h2>

        <div style={s.calGrid}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={s.calWeekday}>
              {d}
            </div>
          ))}

          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const isCompleted = completedDates.has(dateStr);

            return (
              <div key={day} style={s.calDay(isCompleted, isToday)}>
                {day}
              </div>
            );
          })}
        </div>

        <p
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          이번 달{" "}
          <strong style={{ color: "#111" }}>
            {
              Array.from(completedDates).filter((d) =>
                d.startsWith(
                  `${calYear}-${String(calMonth + 1).padStart(2, "0")}`
                )
              ).length
            }
            일
          </strong>{" "}
          실천
        </p>
      </div>

      {/* ── 최근 시청 기록 테이블 ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>최근 시청 기록 (90일)</h2>

        {watchRecords.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            시청 기록이 없습니다.
          </p>
        ) : (
          <table style={s.recordTable}>
            <thead>
              <tr>
                <th style={s.rth}>날짜</th>
                <th style={s.rth}>프로그램</th>
                <th style={s.rth}>주차</th>
                <th style={s.rth}>완료</th>
              </tr>
            </thead>
            <tbody>
              {watchRecords.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  <td style={s.rtd}>{fmtDate(r.watchDate)}</td>
                  <td style={s.rtd}>{getProgramName(r.programId)}</td>
                  <td style={s.rtd}>{r.weekNumber ?? "-"}주차</td>
                  <td style={s.rtd}>
                    {r.isCompleted ? (
                      <span style={{ color: "#059669" }}>완료</span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>미완료</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 회원 삭제 ── */}
      <div style={{ ...s.section, borderColor: "#fecaca" }}>
        <h2 style={{ ...s.sectionTitle, color: "#dc2626" }}>위험 영역</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          회원을 삭제하면 Cognito 계정이 즉시 삭제되고, DynamoDB의 개인정보가 익명화 처리됩니다.
          이 작업은 되돌릴 수 없습니다.
        </p>
        <button
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            background: "#fff",
            color: "#dc2626",
            border: "2px solid #dc2626",
            borderRadius: 8,
            cursor: "pointer",
          }}
          onClick={() => setShowDeleteModal(true)}
        >
          회원 삭제
        </button>
      </div>

      {/* ── 삭제 확인 모달 ── */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "28px 32px",
              maxWidth: 440,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 12 }}>
              회원을 삭제하시겠습니까?
            </h3>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
              <strong style={{ color: "#111" }}>{user.name || user.email || userId}</strong> 회원의
              다음 데이터가 처리됩니다:
            </p>
            <ul style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, paddingLeft: 20, marginBottom: 20 }}>
              <li>Cognito 계정 즉시 삭제</li>
              <li>DynamoDB 8개 테이블 익명화</li>
              <li>개인정보(이름, 이메일, 전화번호 등) 영구 삭제</li>
              <li>분석용 데이터(시청 기록, 습관 등)는 익명화하여 보존</li>
            </ul>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                취소
              </button>
              <button
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity: deleting ? 0.6 : 1,
                }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제 확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
