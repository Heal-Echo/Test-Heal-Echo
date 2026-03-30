"use client";

import React, { useEffect } from "react";
import styles from "./ComingSoonModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ComingSoonModal({ open, onClose }: Props) {
  /* ESC 키로 닫기 */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  /* 배경 스크롤 방지 */
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 장식 아이콘 */}
        <div className={styles.iconWrap}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="24" cy="24" r="24" fill="url(#grad)" />
            <path
              d="M24 14v12M24 30h.02"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48">
                <stop stopColor="#00D6F5" />
                <stop offset="1" stopColor="#8A2BE2" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className={styles.title}>Coming Soon</h2>
        <p className={styles.desc}>
          현재 준비 중입니다.<br />
          곧 만나보실 수 있습니다.
        </p>

        <button className={styles.closeBtn} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
