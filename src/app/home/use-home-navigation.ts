"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSelectedProgram, isSelectionConfirmed } from "@/lib/programSelection";
import { PROGRAMS } from "@/config/programs";

export function useHomeNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHighlightWellness, setIsHighlightWellness] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

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
      // URL에서 query param 제거 (히스토리 오염 방지)
      window.history.replaceState(null, "", "/home");

      if (!navigateIfConfirmed()) {
        // 미선택 고객 → 마이 솔루션 모달 열기
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
  // - 솔루션 선택 완료 → /wellness/balance 이동
  // - 미선택 → 홈에서 프로그램 선택 모달 표시
  const handleAutobalanceClick = () => {
    const program = getSelectedProgram();
    const confirmed = isSelectionConfirmed();
    if (program && confirmed) {
      router.push("/wellness/balance");
    } else {
      setIsModalOpen(true);
    }
  };

  return {
    isModalOpen,
    isHighlightWellness,
    showComingSoon,
    setShowComingSoon,
    handleOpenModal,
    handleCloseModal,
    closeModal,
    handleAutobalanceClick,
  };
}
