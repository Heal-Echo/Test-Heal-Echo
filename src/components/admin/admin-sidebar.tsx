"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getProgramName } from "@/config/programs";

export default function AdminSidebar() {
  const pathname = usePathname();

  /* ------------------------------
     스타일 객체 선언
  ------------------------------ */
  const menuTitle = {
    marginBottom: "14px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#333",
  } as const;

  const subText = (active: boolean) =>
    ({
      marginBottom: "10px",
      fontSize: "13px",
      fontWeight: 500,
      padding: "4px 0px 4px 12px",
      borderRadius: "4px",
      color: active ? "#1e293b" : "#555",
      backgroundColor: active ? "#e2e8f0" : "transparent",
      cursor: "pointer",
    }) as const;

  const linkStyle = (active: boolean) =>
    ({
      display: "block",
      marginBottom: "16px",
      padding: "6px 10px",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: 600,
      background: active ? "#1e293b" : "transparent",
      color: active ? "#fff" : "#333",
    }) as const;

  /* ------------------------------
     사이드바 렌더링
  ------------------------------ */
  return (
    <aside
      className="h-screen bg-white text-black flex flex-col"
      style={{
        borderRight: "1px solid #e5e7eb",
        fontFamily: "NotoSans, sans-serif",
      }}
    >
      {/* HEADER */}
      <div className="flex flex-col items-center" style={{ paddingTop: 24, paddingBottom: 16 }}>
        <span
          style={{
            fontFamily: "PlayfairDisplay, serif",
            fontWeight: 900,
            fontSize: "18px",
            color: "#111",
            textAlign: "center",
          }}
        >
          Heal Echo
        </span>

        <span
          style={{
            marginTop: 20,
            fontSize: "15px",
            fontWeight: 600,
            color: "#333",
          }}
        >
          관리자 콘솔
        </span>

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "#e5e7eb",
            marginTop: 20,
          }}
        />
      </div>

      {/* MENU */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 20,
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {/* 메인 */}
        <div style={menuTitle}>메인</div>

        <Link href="/admin/dashboard" style={linkStyle(pathname === "/admin/dashboard")}>
          대시보드
        </Link>

        <Link href="/admin/monitoring" style={linkStyle(pathname === "/admin/monitoring")}>
          실시간 모니터링
        </Link>

        {/* ------------------------------
            스튜디오 섹션
        ------------------------------ */}
        <div style={{ ...menuTitle, marginTop: 28 }}>스튜디오</div>

        {/* Introduction */}
        <Link href="/admin/studio/introduction">
          <div style={subText(pathname.startsWith("/admin/studio/introduction"))}>
            · Introduction
          </div>
        </Link>

        {/* Weekly Solution */}
        <div style={{ ...menuTitle, marginTop: 24, fontSize: "13px" }}>위클리 솔루션</div>

        <Link href="/admin/studio/weekly-solution/autobalance">
          <div style={subText(pathname.startsWith("/admin/studio/weekly-solution/autobalance"))}>
            · {getProgramName("autobalance")}
          </div>
        </Link>

        <Link href="/admin/studio/weekly-solution/womans-whisper">
          <div style={subText(pathname.startsWith("/admin/studio/weekly-solution/womans-whisper"))}>
            · {getProgramName("womans-whisper")}
          </div>
        </Link>

        <Link href="/admin/studio/weekly-solution/healing-mind">
          <div style={subText(pathname.startsWith("/admin/studio/weekly-solution/healing-mind"))}>
            · 힐링 마인드
          </div>
        </Link>

        {/* Weekly Habit */}
        <div style={{ ...menuTitle, marginTop: 24, fontSize: "13px" }}>위클리 해빗</div>

        <Link href="/admin/studio/weekly-habit/autobalance">
          <div style={subText(pathname === "/admin/studio/weekly-habit/autobalance")}>
            · {getProgramName("autobalance")}
          </div>
        </Link>

        <Link href="/admin/studio/weekly-habit/autobalance/sleep-habit">
          <div
            style={{
              ...subText(pathname.startsWith("/admin/studio/weekly-habit/autobalance/sleep-habit")),
              paddingLeft: 28,
              fontSize: "12px",
            }}
          >
            └ 수면 습관
          </div>
        </Link>

        <Link href="/admin/studio/weekly-habit/womans-whisper">
          <div style={subText(pathname.startsWith("/admin/studio/weekly-habit/womans-whisper"))}>
            · {getProgramName("womans-whisper")}
          </div>
        </Link>

        <Link href="/admin/studio/weekly-habit/healing-mind">
          <div style={subText(pathname.startsWith("/admin/studio/weekly-habit/healing-mind"))}>
            · 힐링 마인드
          </div>
        </Link>

        {/* Sea of Understanding */}
        <div style={{ ...menuTitle, marginTop: 28 }}>이해의 바다</div>

        <Link href="/admin/studio/sea-of-understanding">
          <div style={subText(pathname.startsWith("/admin/studio/sea-of-understanding"))}>
            · Understanding Video
          </div>
        </Link>

        {/* 회원 관리 */}
        <div style={{ ...menuTitle, marginTop: 32 }}>회원 관리</div>

        <Link href="/admin/members">
          <div style={subText(pathname.startsWith("/admin/members"))}>· 회원 목록</div>
        </Link>
        <div style={{ ...subText(false), color: "#bbb", cursor: "default" }}>
          · 유료 결제 정보 (준비 중)
        </div>
        <div style={{ ...subText(false), color: "#bbb", cursor: "default" }}>
          · 결제 수단 / 프로모션 (준비 중)
        </div>
        <div style={{ ...subText(false), color: "#bbb", cursor: "default" }}>
          · 환불 및 취소 이력 (준비 중)
        </div>

        {/* 관리자 권한 */}
        <div style={{ ...menuTitle, marginTop: 32 }}>관리자 권한</div>
        <div style={subText(false)}>· 아이디별 권한 관리 (준비 중)</div>
      </nav>

      {/* FOOTER */}
      <div
        className="px-4 py-4 text-center"
        style={{
          borderTop: "1px solid #e5e7eb",
          fontSize: "12px",
          color: "#888",
        }}
      >
        v1 관리자 레이아웃
      </div>
    </aside>
  );
}
