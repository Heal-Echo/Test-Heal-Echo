"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./bottomTab.module.css";
import ComingSoonModal from "@/components/publicSite/ComingSoonModal";
import { getSelectedProgram, isSelectionConfirmed } from "@/lib/programSelection";

/** 프로그램 ID → 솔루션 페이지 경로 */
const PROGRAM_ROUTES: Record<string, string> = {
  autobalance: "/wellness/balance",
  // womans-whisper: 추후 추가
};

export default function BottomTab() {
  const pathname = usePathname();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  // 탭 순서: home → yoga → wellness → meditation → mypage
  const tabs = [
    { href: "/home", icon: "/assets/images/home.png", name: "home" },
    { href: "#yoga", icon: "/assets/images/yoga.png", name: "yoga" },
    { href: "/wellness/weekly-habit", icon: "/assets/images/wellness_habit.png", name: "wellness" },
    { href: "/understanding", icon: "/assets/images/meditation.png", name: "meditation" },
    { href: "/mypage", icon: "/assets/images/my_page.png", name: "mypage" },
  ];

  /** yoga 탭 클릭 핸들러 */
  function handleYogaClick(e: React.MouseEvent) {
    e.preventDefault();

    const program = getSelectedProgram();
    const confirmed = isSelectionConfirmed();

    if (program && confirmed) {
      const route = PROGRAM_ROUTES[program];
      if (route) {
        router.push(route);
      } else {
        // womans-whisper 등 아직 미지원 솔루션
        setShowComingSoon(true);
      }
    } else {
      // 무료 체험 시작 전 → home의 마이 솔루션과 동일한 안내
      setShowModal(true);
    }
  }

  /** 모달 확인 → home 웰니스 섹션으로 이동 */
  function handleModalConfirm() {
    setShowModal(false);
    router.push("/home?highlight=wellness");
  }

  return (
    <>
      <div className={styles.bottomTab}>
        {tabs.map((tab) => {
          const isYoga = tab.name === "yoga";
          const isWellness = tab.name === "wellness";
          const isActive =
            isYoga
              ? pathname.startsWith("/wellness/solution") || pathname.startsWith("/wellness/balance") || pathname.startsWith("/yoga")
              : isWellness
              ? pathname.startsWith("/wellness/weekly-habit")
              : pathname.startsWith(tab.href);

          // yoga 탭은 Link 대신 버튼으로 처리
          if (isYoga) {
            return (
              <button
                key={tab.name}
                className={styles.tabItem}
                onClick={handleYogaClick}
                type="button"
              >
                <Image
                  src={tab.icon}
                  alt={tab.name}
                  width={28}
                  height={28}
                  className={`${styles.tabIcon} ${isActive ? styles.active : ""}`}
                />
              </button>
            );
          }

          return (
            <Link key={tab.name} href={tab.href} className={styles.tabItem}>
              <Image
                src={tab.icon}
                alt={tab.name}
                width={28}
                height={28}
                className={`${styles.tabIcon} ${isActive ? styles.active : ""}`}
              />
            </Link>
          );
        })}
      </div>

      {/* 무료 체험 전 안내 모달 (home 마이 솔루션과 동일) */}
      {showModal && (
        <div className={styles.yogaModalOverlay} onClick={handleModalConfirm}>
          <div
            className={styles.yogaModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.yogaModalText}>
              관심있는 웰니스 솔루션을 선택하세요.
            </p>
            <button
              className={styles.yogaModalBtn}
              onClick={handleModalConfirm}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Coming Soon (미지원 솔루션) */}
      <ComingSoonModal
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
      />
    </>
  );
}
