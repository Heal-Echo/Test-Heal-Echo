"use client";

import { useState, useEffect } from "react";
import { getSubscription, getSubscriptionSync } from "@/auth/subscription";
import { PROGRAMS_LIST, PROGRAMS, ProgramInfo } from "@/config/programs";
import { getSelectedProgram, isSelectionConfirmed } from "@/lib/programSelection";

export function useHomeSubscription() {
  const [subscribedProgram, setSubscribedProgram] = useState<{
    id: string;
    name: string;
    image: string;
    href: string | null;
  } | null>(null);
  const [isSubLoaded, setIsSubLoaded] = useState(false);
  const [confirmedProgram, setConfirmedProgram] = useState<ProgramInfo | null>(null);

  // ▶ confirmed 상태 갱신 (browser + confirmed 고객용)
  function refreshConfirmedProgram() {
    const selectedId = getSelectedProgram();
    if (selectedId && isSelectionConfirmed()) {
      const prog = PROGRAMS[selectedId];
      if (prog) {
        setConfirmedProgram(prog);
        return;
      }
    }
    setConfirmedProgram(null);
  }

  // ▶ 구독 상태 확인: 캐시 즉시 표시 → 백그라운드 갱신
  useEffect(() => {
    function findSubscribed(
      getSub: (id: string) => { subscriptionType: string }
    ) {
      for (const prog of PROGRAMS_LIST) {
        const sub = getSub(prog.id);
        if (sub.subscriptionType === "free_trial" || sub.subscriptionType === "paid") {
          return {
            id: prog.id,
            name: prog.name,
            image: prog.image,
            href: prog.route,
          };
        }
      }
      return null;
    }

    // 1단계: 캐시에서 즉시 표시 (로그인 시 prefetch된 데이터)
    const cached = findSubscribed(getSubscriptionSync);
    if (cached) {
      setSubscribedProgram(cached);
      setIsSubLoaded(true);
    }

    // 2단계: 백그라운드에서 최신 데이터 갱신
    async function refreshSubscriptions() {
      const results = await Promise.all(
        PROGRAMS_LIST.map((prog) => getSubscription(prog.id))
      );

      const fresh = findSubscribed((id) => {
        const idx = PROGRAMS_LIST.findIndex((p) => p.id === id);
        return results[idx];
      });

      // 캐시와 다를 때만 업데이트 (불필요한 리렌더 방지)
      if (fresh?.id !== cached?.id) {
        setSubscribedProgram(fresh);
      }
      setIsSubLoaded(true);
      // 구독이 없는 경우 confirmed 상태 체크
      if (!fresh) refreshConfirmedProgram();
    }

    refreshSubscriptions();
  }, []);

  return { subscribedProgram, isSubLoaded, confirmedProgram, refreshConfirmedProgram };
}
