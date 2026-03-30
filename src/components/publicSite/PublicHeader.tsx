"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./PublicHeader.module.css";
import ComingSoonModal from "./ComingSoonModal";
import { getProgramName } from "@/config/programs";

export default function PublicHeader() {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 메뉴 열려있을 때 body 스크롤 잠금
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // 창 크기 커지면 메뉴 자동 닫기
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <header className={`${styles.header} public-header`}>
        <div className={styles.inner}>
          {/* 로고 */}
          <Link href="/public/landing" className={styles.logoWrap}>
            <Image
              src="/assets/images/webp/Logo_HealEcho.webp"
              alt="Heal Echo 로고"
              width={40}
              height={40}
              sizes="40px"
              priority
              className={styles.logoImg}
            />
            <span className={styles.brand}>Heal Echo</span>
          </Link>

          {/* 데스크톱 네비게이션 — 웰니스 솔루션만 */}
          <nav className={styles.nav}>
            <Link href="/public/miraclereset" className={styles.navLink}>
              {getProgramName("autobalance")}
            </Link>
            <button
              type="button"
              className={`${styles.navLink} ${styles.navLinkSoon}`}
              onClick={() => setShowComingSoon(true)}
            >
              {getProgramName("womans-whisper")}
            </button>
          </nav>

          {/* 데스크톱 액션 버튼 */}
          <div className={styles.actions}>
            <Link href="/public/pricing" className={styles.pricingLink}>
              가격
            </Link>
            <Link href="/public/login" className={styles.loginBtn}>
              로그인
            </Link>
            <Link href="/public/login" className={styles.freeBtn}>
              무료 체험
            </Link>
          </div>

          {/* 모바일 햄버거 */}
          <button
            type="button"
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* 모바일 드롭다운 패널 */}
      {menuOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMenuOpen(false)} />
      )}
      <div className={`${styles.mobilePanel} ${menuOpen ? styles.mobilePanelOpen : ""}`}>
        <div className={styles.mobilePanelLine} />

        <nav className={styles.mobileNav}>
          <Link
            href="/public/miraclereset"
            className={styles.mobileNavItem}
            onClick={() => setMenuOpen(false)}
          >
            <span className={styles.mobileNavIcon}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-6.5 17a1 1 0 0 1 0-2h4l2-3-3-2a1 1 0 1 1 1.1-1.66l2.4 1.6 2.4-1.6A1 1 0 0 1 16.5 12l-3 2 2 3h4a1 1 0 1 1 0 2H5.5Z" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.mobileNavText}>
              <span className={styles.mobileNavTitle}>{getProgramName("autobalance")}</span>
              <span className={styles.mobileNavDesc}>자율신경 밸런스 맞춤 솔루션</span>
            </span>
            <span className={styles.mobileNavArrow}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>

          <button
            type="button"
            className={styles.mobileNavItem}
            onClick={() => {
              setMenuOpen(false);
              setShowComingSoon(true);
            }}
          >
            <span className={styles.mobileNavIcon}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.mobileNavText}>
              <span className={styles.mobileNavTitle}>{getProgramName("womans-whisper")}</span>
              <span className={styles.mobileNavDesc}>여성 맞춤 웰니스 솔루션</span>
            </span>
            <span className={styles.mobileNavArrow}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

        </nav>

        <Link
          href="/public/pricing"
          className={styles.mobilePricingLink}
          onClick={() => setMenuOpen(false)}
        >
          가격 · 환불 정책
        </Link>

        <div className={styles.mobileBtnGroup}>
          <Link
            href="/public/login"
            className={styles.mobileLoginBtn}
            onClick={() => setMenuOpen(false)}
          >
            로그인
          </Link>
          <Link
            href="/public/login"
            className={styles.mobileFreeBtn}
            onClick={() => setMenuOpen(false)}
          >
            Heal Echo 무료 체험
          </Link>
        </div>
      </div>

      <ComingSoonModal
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
      />
    </>
  );
}
