"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSelectedProgram,
  isSelectionConfirmed,
  syncProgramSelection,
} from "@/lib/program-selection";
import { PROGRAMS } from "@/config/programs";

export function useHomeNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHighlightWellness, setIsHighlightWellness] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // 무료 체험 확인 모달 상태
  const [isTrialConfirmOpen, setIsTrialConfirmOpen] = useState(false);
  const trialDestinationRef = useRef("/wellness/balance");

  // 이미 솔루션을 선택한 고객이면 바로 이동, 아니면 false 반환
  function navigateIfConfirmed(): boolean {
    const selectedId = getSelectedProgram();
    if (selectedId && isSelectionConfirmed()) {
      const route = PROGRAMS[selectedId]?.route;
      if (route) {
        router.push(route);
        return true;
      }
    }
    return false;
  }

  // ▶ yoga 탭 → home 리다이렉트 시 웰니스 섹션 하이라이트
  useEffect(() => {
    if (searchParams.get("highlight") === "wellness") {
      window.history.replaceState(null, "", "/home");

      if (!navigateIfConfirmed()) {
        setIsModalOpen(true);
      }
    }
  }, [searchParams, router]);

  const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!navigateIfConfirmed()) {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);

    setIsHighlightWellness(true);
    setTimeout(() => {
      setIsHighlightWellness(false);
    }, 2000);

    if (typeof document !== "undefined") {
      const target = document.getElementById("wellnessSection");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const closeModal = () => setIsModalOpen(false);

  // 웰니스 솔루션 "기적의 오토 밸런스" 카드 클릭
  const handleAutobalanceClick = () => {
    const program = getSelectedProgram();
    const confirmed = isSelectionConfirmed();
    if (program && confirmed) {
      router.push("/wellness/balance");
    } else {
      setIsAccordionOpen((prev) => !prev);
    }
  };

  // 무료 체험 확인 모달 열기 (목적지 지정 가능)
  const requestTrialStart = useCallback((destination = "/wellness/balance") => {
    trialDestinationRef.current = destination;
    setIsTrialConfirmOpen(true);
  }, []);

  // 확인 모달에서 "시작하기" 클릭
  const confirmTrialStart = useCallback(() => {
    setIsTrialConfirmOpen(false);
    syncProgramSelection("autobalance");
    router.push(trialDestinationRef.current);
  }, [router]);

  // 확인 모달에서 "취소" 클릭
  const cancelTrialStart = useCallback(() => {
    setIsTrialConfirmOpen(false);
  }, []);

  // 기존 handleTrialStart → 확인 모달을 통해 실행
  const handleTrialStart = useCallback(() => {
    requestTrialStart("/wellness/balance");
  }, [requestTrialStart]);

  return {
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
  };
}
