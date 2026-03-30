"use client";

import React, { useEffect, useState } from "react";

/* ─── 타입 ─── */
type DashboardStats = {
  totalUsers: number;
  profileCompleted: number;
  profileIncomplete: number;
  goalDistribution: Record<string, number>;
  dietDistribution: Record<string, number>;
  sleepDistribution: Record<string, number>;
  experienceDistribution: Record<string, number>;
  genderDistribution: Record<string, number>;
  marketingConsented: number;
  pushEnabled: number;
  emailEnabled: number;
  signupTrend: Record<string, number>;
};

/* ─── 라벨 매핑 ─── */
const GOAL_LABEL: Record<string, string> = {
  "auto-balance": "오토밸런스",
  "womens-care": "우먼즈 케어",
  "healing-mind": "힐링 마인드",
};
const DIET_LABEL: Record<string, string> = {
  practicing: "실천 중",
  interested: "관심 있음",
  "not-yet": "아직",
};
const SLEEP_LABEL: Record<string, string> = {
  practicing: "실천 중",
  interested: "관심 있음",
  "not-yet": "아직",
};
const EXP_LABEL: Record<string, string> = {
  beginner: "처음",
  casual: "가끔",
  regular: "꾸준히",
};
const GENDER_LABEL: Record<string, string> = {
  female: "여성",
  male: "남성",
  other: "기타",
};

const GOAL_COLOR: Record<string, string> = {
  "auto-balance": "#6366f1",
  "womens-care": "#ec4899",
  "healing-mind": "#10b981",
};

/* ─── 스타일 ─── */
const s = {
  container: {
    padding: "32px 40px",
    maxWidth: 1100,
    fontFamily: "NotoSans, sans-serif",
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111",
    marginBottom: 8,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 28,
  } as React.CSSProperties,

  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 28,
  } as React.CSSProperties,

  metricCard: {
    padding: "20px 24px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } as React.CSSProperties,

  metricLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  } as React.CSSProperties,

  metricValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111",
  } as React.CSSProperties,

  metricSub: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  } as React.CSSProperties,

  chartsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 28,
  } as React.CSSProperties,

  chartCard: {
    padding: "24px 28px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
  } as React.CSSProperties,

  chartTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111",
    marginBottom: 16,
  } as React.CSSProperties,

  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  } as React.CSSProperties,

  barLabel: {
    width: 80,
    fontSize: 13,
    color: "#374151",
    textAlign: "right" as const,
    flexShrink: 0,
  } as React.CSSProperties,

  barTrack: {
    flex: 1,
    height: 24,
    background: "#f3f4f6",
    borderRadius: 6,
    overflow: "hidden" as const,
  } as React.CSSProperties,

  barCount: {
    width: 36,
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    textAlign: "right" as const,
    flexShrink: 0,
  } as React.CSSProperties,

  trendRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
    height: 120,
    padding: "0 4px",
  } as React.CSSProperties,

  trendBarWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,

  trendLabel: {
    fontSize: 11,
    color: "#9ca3af",
  } as React.CSSProperties,

  trendCount: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  } as React.CSSProperties,
};

/* ─── 바 차트 컴포넌트 ─── */
function BarChart({
  data,
  labels,
  color = "#6366f1",
}: {
  data: Record<string, number>;
  labels: Record<string, string>;
  color?: string;
}) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div>
      {entries.map(([key, count]) => (
        <div key={key} style={s.barRow}>
          <div style={s.barLabel}>{labels[key] || key}</div>
          <div style={s.barTrack}>
            <div
              style={{
                width: `${(count / max) * 100}%`,
                height: "100%",
                background: color,
                borderRadius: 6,
                minWidth: count > 0 ? 4 : 0,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div style={s.barCount}>{count}</div>
        </div>
      ))}
      {entries.length === 0 && (
        <p style={{ color: "#d1d5db", fontSize: 13 }}>데이터 없음</p>
      )}
    </div>
  );
}

/* ─── 메인 ─── */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard-stats", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("[Dashboard] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={s.container}>
        <p style={{ color: "#9ca3af" }}>불러오는 중...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={s.container}>
        <p style={{ color: "#ef4444" }}>통계 데이터를 불러오지 못했습니다.</p>
      </div>
    );
  }

  const profileRate = stats.totalUsers
    ? Math.round((stats.profileCompleted / stats.totalUsers) * 100)
    : 0;

  const marketingRate = stats.profileCompleted
    ? Math.round((stats.marketingConsented / stats.profileCompleted) * 100)
    : 0;

  const todaySignups = stats.signupTrend
    ? stats.signupTrend[new Date().toISOString().split("T")[0]] || 0
    : 0;

  const trendEntries = Object.entries(stats.signupTrend || {});
  const maxTrend = Math.max(...trendEntries.map(([, v]) => v), 1);

  return (
    <div style={s.container}>
      <h1 style={s.title}>대시보드</h1>
      <p style={s.subtitle}>회원 프로필 및 서비스 이용 현황</p>

      {/* ── 상단 지표 카드 ── */}
      <div style={s.metricsRow}>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>전체 회원</div>
          <div style={s.metricValue}>{stats.totalUsers}명</div>
          <div style={s.metricSub}>오늘 가입 {todaySignups}명</div>
        </div>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>프로필 완료</div>
          <div style={s.metricValue}>{stats.profileCompleted}명</div>
          <div style={s.metricSub}>완료율 {profileRate}%</div>
        </div>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>마케팅 동의</div>
          <div style={s.metricValue}>{stats.marketingConsented}명</div>
          <div style={s.metricSub}>동의율 {marketingRate}%</div>
        </div>
        <div style={s.metricCard}>
          <div style={s.metricLabel}>알림 설정</div>
          <div style={s.metricValue}>
            <span style={{ fontSize: 16 }}>푸시 {stats.pushEnabled}</span>
            <span style={{ fontSize: 14, color: "#9ca3af", margin: "0 6px" }}>/</span>
            <span style={{ fontSize: 16 }}>이메일 {stats.emailEnabled}</span>
          </div>
          <div style={s.metricSub}>프로필 완료 회원 기준</div>
        </div>
      </div>

      {/* ── 차트 영역 ── */}
      <div style={s.chartsRow}>
        {/* 프로그램(케어) 분포 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>프로그램 선택 분포</div>
          {Object.entries(stats.goalDistribution).length > 0 ? (
            <div>
              {Object.entries(stats.goalDistribution).map(([key, count]) => {
                const max = Math.max(...Object.values(stats.goalDistribution), 1);
                return (
                  <div key={key} style={s.barRow}>
                    <div style={s.barLabel}>{GOAL_LABEL[key] || key}</div>
                    <div style={s.barTrack}>
                      <div
                        style={{
                          width: `${(count / max) * 100}%`,
                          height: "100%",
                          background: GOAL_COLOR[key] || "#6366f1",
                          borderRadius: 6,
                          minWidth: count > 0 ? 4 : 0,
                        }}
                      />
                    </div>
                    <div style={s.barCount}>{count}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#d1d5db", fontSize: 13 }}>데이터 없음</p>
          )}
        </div>

        {/* 경험 수준 분포 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>경험 수준 분포</div>
          <BarChart
            data={stats.experienceDistribution}
            labels={EXP_LABEL}
            color="#8b5cf6"
          />
        </div>
      </div>

      <div style={s.chartsRow}>
        {/* 식습관 분포 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>식습관 분포</div>
          <BarChart
            data={stats.dietDistribution}
            labels={DIET_LABEL}
            color="#f59e0b"
          />
        </div>

        {/* 수면습관 분포 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>수면습관 분포</div>
          <BarChart
            data={stats.sleepDistribution}
            labels={SLEEP_LABEL}
            color="#3b82f6"
          />
        </div>
      </div>

      <div style={s.chartsRow}>
        {/* 성별 분포 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>성별 분포</div>
          <BarChart
            data={stats.genderDistribution}
            labels={GENDER_LABEL}
            color="#14b8a6"
          />
        </div>

        {/* 최근 7일 가입 추이 */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>최근 7일 가입 추이</div>
          <div style={s.trendRow}>
            {trendEntries.map(([date, count]) => (
              <div key={date} style={s.trendBarWrap}>
                <div style={s.trendCount}>{count}</div>
                <div
                  style={{
                    width: 32,
                    height: `${Math.max((count / maxTrend) * 80, 4)}px`,
                    background: "#6366f1",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.4s ease",
                  }}
                />
                <div style={s.trendLabel}>
                  {date.slice(5).replace("-", "/")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
