"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import styles from "./home.module.css";
import BottomTab from "@/components/bottom-tab";
import Header from "@/components/header";
import WellnessCarousel from "./wellness-carousel";
import WellnessSection from "./wellness-section";
import MySolutionSection from "./my-solution-section";
import FloatingTrialCta from "./floating-trial-cta";
import TrialConfirmModal from "./trial-confirm-modal";
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
    isAccordionOpen,
    isTrialConfirmOpen,
    showComingSoon,
    setShowComingSoon,
    handleOpenModal,
    handleCloseModal,
    closeModal,
    handleAutobalanceClick,
    handleTrialStart,
    requestTrialStart,
    confirmTrialStart,
    cancelTrialStart,
  } = useHomeNavigation();

  useEffect(() => {
    const name = getUserName();
    setUserName(name);
  }, []);

  // 프로그램 미선택 상태: 맞춤 웰니스 3세트 숨김
  const isPreTrial = confirmedProgram === null && subscribedProgram === null;

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
          isAccordionOpen={isAccordionOpen}
          onAutobalanceClick={handleAutobalanceClick}
          onShowComingSoon={() => setShowComingSoon(true)}
          onTrialStart={handleTrialStart}
          onRequestTrial={requestTrialStart}
        />

        <MySolutionSection
          isSubLoaded={isSubLoaded}
          subscribedProgram={subscribedProgram}
          confirmedProgram={confirmedProgram}
          isAccordionOpen={isAccordionOpen}
          onShowComingSoon={() => setShowComingSoon(true)}
          onOpenModal={handleOpenModal}
          onTrialStart={handleTrialStart}
        />

        {!isPreTrial && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerLabel}>맞춤 웰니스 3세트</span>
              <span className={styles.dividerLine} />
            </div>

            <WellnessCarousel />
          </>
        )}
      </main>

      <FloatingTrialCta visible={isAccordionOpen} onStart={handleTrialStart} />

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
      <TrialConfirmModal
        open={isTrialConfirmOpen}
        onConfirm={confirmTrialStart}
        onCancel={cancelTrialStart}
      />
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
