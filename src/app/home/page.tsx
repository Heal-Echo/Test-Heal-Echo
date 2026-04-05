"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import styles from "./home.module.css";
import BottomTab from "@/components/bottom-tab";
import Header from "@/components/header";
import WellnessCarousel from "./wellness-carousel";
import WellnessSection from "./wellness-section";
import MySolutionSection from "./my-solution-section";
import { getUserName } from "@/auth/user";
import { useHomeInit } from "./use-home-init";
import { useHomeSubscription } from "./use-home-subscription";
import { useHomeNavigation } from "./use-home-navigation";

const ProgramSelectModal = dynamic(() => import("./program-select-modal"), {
  ssr: false,
});
const ComingSoonModal = dynamic(() => import("@/components/publicSite/coming-soon-modal"), {
  ssr: false,
});

function HomeContent() {
  const [userName, setUserName] = useState<string | null>(null);

  const { subscribedProgram, isSubLoaded, confirmedProgram, refreshConfirmedProgram } =
    useHomeSubscription();
  useHomeInit(refreshConfirmedProgram);
  const {
    isModalOpen,
    isHighlightWellness,
    showComingSoon,
    setShowComingSoon,
    handleOpenModal,
    handleCloseModal,
    closeModal,
    handleAutobalanceClick,
  } = useHomeNavigation();

  useEffect(() => {
    const name = getUserName();
    setUserName(name);
  }, []);

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {userName && (
          <div className={styles.greeting}>
            <p className={styles.greetingText}>
              반갑습니다. <strong>{userName}</strong>님
            </p>
          </div>
        )}

        <WellnessSection
          isHighlightWellness={isHighlightWellness}
          onAutobalanceClick={handleAutobalanceClick}
          onShowComingSoon={() => setShowComingSoon(true)}
        />

        <MySolutionSection
          isSubLoaded={isSubLoaded}
          subscribedProgram={subscribedProgram}
          confirmedProgram={confirmedProgram}
          onShowComingSoon={() => setShowComingSoon(true)}
          onOpenModal={handleOpenModal}
        />

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerLabel}>맞춤 웰니스 3세트</span>
          <span className={styles.dividerLine} />
        </div>

        <WellnessCarousel />
      </main>

      <div className={styles.tabPadding}></div>

      <BottomTab />

      {isModalOpen && (
        <ProgramSelectModal
          onClose={handleCloseModal}
          onShowComingSoon={() => {
            closeModal();
            setShowComingSoon(true);
          }}
        />
      )}
      <ComingSoonModal open={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
