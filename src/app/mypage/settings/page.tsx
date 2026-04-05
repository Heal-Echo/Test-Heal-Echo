// src/app/mypage/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import { isUserLoggedIn, getUserInfo, userLogout } from "@/auth/user";
import { setSession } from "@/lib/storage";

/* ── 메뉴 항목 정의 (4개로 정리) ── */
const MENU_ITEMS = [
  {
    id: "account",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    label: "계정 관리",
    route: "/mypage/settings/account",
  },
  {
    id: "subscription",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    label: "구독 관리",
    route: "/mypage/settings/subscription",
  },
  {
    id: "help",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    label: "도움말 & 지원",
    route: "/mypage/settings/withdraw",
  },
  {
    id: "info",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    label: "정보",
    route: "",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }
    const info = getUserInfo();
    setEmail(info?.email || "");
  }, [router]);

  // 로그아웃 처리 (힐에코에서만 로그아웃 — 카카오 세션은 유지)
  function handleLogout() {
    try {
      userLogout();
    } catch (err) {
      console.error("로그아웃 에러:", err);
    }

    // sessionStorage에 로그아웃 출처 기록 (로그인 페이지에서 뒤로가기 방지용)
    setSession("logoutFrom", "mypage");

    // 강제 전체 페이지 이동 (replace로 현재 페이지를 히스토리에서 제거)
    window.location.replace("/public/landing");
    return; // 이후 코드 실행 차단
  }

  function handleMenuClick(id: string, route: string) {
    if (route) {
      router.push(route);
    }
    // route 없는 항목은 추후 연결
  }

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* ── 뒤로가기 + 타이틀 ── */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>설정</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* ── 메뉴 리스트 ── */}
        <div className={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={styles.menuItem}
              onClick={() => handleMenuClick(item.id, item.route)}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              <div className={styles.menuText}>
                <span className={styles.menuLabel}>{item.label}</span>
              </div>
              <span className={styles.menuArrow}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {/* ── 로그아웃 ── */}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          로그아웃
        </button>

        {/* ── 푸터: 버전 + 로그인 계정 ── */}
        <footer className={styles.footer}>
          <span className={styles.footerVersion}>v0.00</span>
          <span className={styles.footerEmail}>{email || "—"}</span>
        </footer>
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
