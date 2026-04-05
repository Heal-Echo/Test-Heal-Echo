"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./bottomTab.module.css";
import * as storage from "@/lib/storage";
import { getSelectedProgram, isSelectionConfirmed } from "@/lib/program-selection";
import ComingSoonModal from "@/components/publicSite/coming-soon-modal";

const ProgramSelectModal = dynamic(() => import("@/app/home/program-select-modal"), {
  ssr: false,
});

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

  /** yoga 탭 클릭 핸들러
   * 1. 솔루션 미선택 → 프로그램 선택 모달
   * 2. 솔루션 선택 + balance 경유 이력 있음 → /wellness/solution
   * 3. 솔루션 선택 + balance 경유 이력 없음 → /wellness/balance (다음부터 solution)
   */
  function handleYogaClick(e: React.MouseEvent) {
    e.preventDefault();

    const program = getSelectedProgram();
    const confirmed = isSelectionConfirmed();

    if (!program || !confirmed) {
      setShowModal(true);
      return;
    }

    const hasVisitedBalance = storage.getSession("balance_hub_visited") === "true";

    if (hasVisitedBalance) {
      router.push("/wellness/solution");
    } else {
      storage.setSession("balance_hub_visited", "true");
      router.push("/wellness/balance");
    }
  }

  /** wellness(weekly-habit) 탭 클릭 핸들러
   * - 솔루션 미선택 → 프로그램 선택 모달
   * - 솔루션 선택 완료 → /wellness/weekly-habit 이동
   */
  function handleWellnessClick(e: React.MouseEvent) {
    e.preventDefault();

    const program = getSelectedProgram();
    const confirmed = isSelectionConfirmed();

    if (!program || !confirmed) {
      setShowModal(true);
      return;
    }

    router.push("/wellness/weekly-habit");
  }

  return (
    <>
      <div className={styles.bottomTab}>
        {tabs.map((tab) => {
          const isYoga = tab.name === "yoga";
          const isWellness = tab.name === "wellness";
          const isActive = isYoga
            ? pathname.startsWith("/wellness/solution") ||
              pathname.startsWith("/wellness/balance") ||
              pathname.startsWith("/yoga")
            : isWellness
              ? pathname.startsWith("/wellness/weekly-habit")
              : pathname.startsWith(tab.href);

          if (isYoga || isWellness) {
            const handleClick = isYoga ? handleYogaClick : handleWellnessClick;
            return (
              <button key={tab.name} className={styles.tabItem} onClick={handleClick} type="button">
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

      {showModal && (
        <ProgramSelectModal
          onClose={() => setShowModal(false)}
          onShowComingSoon={() => {
            setShowModal(false);
            setShowComingSoon(true);
          }}
        />
      )}

      <ComingSoonModal open={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </>
  );
}
