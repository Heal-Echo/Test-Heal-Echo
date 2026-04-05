// src/app/mypage/settings/subscription/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./subscription.module.css";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import { isUserLoggedIn, getUserName } from "@/auth/user";
import { getSubscription, getWatchRecords } from "@/auth/subscription";
import { makeThumbnailUrl } from "@/config/constants";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import type { UserSubscription, WatchRecord } from "@/types/subscription";
import { getProgramName } from "@/config/programs";
import {
  fetchAndHydrateSelfCheckResult,
  getSignalIntensity,
  getSignalGrade,
} from "@/components/self-check/self-check-survey";

// ── CTA 라우팅 헬퍼: "기록 보기" 계열 → /mypage/wellness-record, "시작하기" 계열 → /wellness/solution ──
const RECORD_CTA_KEYWORDS = ["기록", "확인하기"];
function getCtaRoute(ctaText: string): string {
  if (RECORD_CTA_KEYWORDS.some((kw) => ctaText.includes(kw))) {
    return "/mypage/wellness-record";
  }
  return "/wellness/solution";
}

// ── 카드 브랜드 아이콘 컴포넌트 ──
function CardBrandIcon({ company }: { company: string }) {
  const size = 20;
  const normalized = company.replace(/카드$/, "").trim().toLowerCase();

  // 카드사명 → 브랜드 색상 매핑
  const brandMap: Record<string, { color: string; label: string }> = {
    신한: { color: "#0046FF", label: "신한" },
    삼성: { color: "#1428A0", label: "삼성" },
    현대: { color: "#003D6B", label: "현대" },
    kb: { color: "#FFC600", label: "KB" },
    kb국민: { color: "#FFC600", label: "KB" },
    국민: { color: "#FFC600", label: "KB" },
    하나: { color: "#009B8D", label: "하나" },
    우리: { color: "#0068B7", label: "우리" },
    롯데: { color: "#ED1C24", label: "롯데" },
    bc: { color: "#F04E37", label: "BC" },
    nh: { color: "#00703C", label: "NH" },
    nh농협: { color: "#00703C", label: "NH" },
    농협: { color: "#00703C", label: "NH" },
    씨티: { color: "#003DA5", label: "CITI" },
    카카오뱅크: { color: "#FEE500", label: "카뱅" },
    토스: { color: "#3182F6", label: "토스" },
    visa: { color: "#1A1F71", label: "VISA" },
    master: { color: "#EB001B", label: "MC" },
    mastercard: { color: "#EB001B", label: "MC" },
  };

  const brand = brandMap[normalized] || { color: "#9ca3af", label: company.slice(0, 2) };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
      aria-label={`${company} 카드`}
    >
      <rect width="20" height="20" rx="4" fill={brand.color} />
      <text
        x="10"
        y="10"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={brand.label.length > 2 ? "5.5" : "7"}
        fontWeight="700"
        fontFamily="Arial, sans-serif"
      >
        {brand.label}
      </text>
    </svg>
  );
}

// ── 2주차 콘텐츠 타입 (영상 목록 API 응답) ──
type BalanceVideoItem = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
  isPublished?: boolean;
};

// ── 활동 요약 계산 유틸 ──
function calcActivitySummary(records: WatchRecord[]) {
  const completed = records.filter((r) => r.isCompleted);
  const uniqueDays = new Set(completed.map((r) => r.watchDate));
  const totalMinutes = Math.round(
    completed.reduce((sum, r) => sum + r.watchDurationSeconds, 0) / 60
  );

  // 연속 참여일 계산 (오늘부터 역순)
  let streak = 0;
  if (uniqueDays.size > 0) {
    const sortedDates = Array.from(uniqueDays).sort().reverse();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(today);

    // 오늘 또는 어제부터 시작 (오늘 아직 안 했으면 어제부터)
    const todayStr = checkDate.toISOString().split("T")[0];
    if (!uniqueDays.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (uniqueDays.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    participationDays: uniqueDays.size,
    totalMinutes,
    streak,
  };
}

// ── PSQI 유틸 (weekly-habit 기준과 동일) ──
function toScore10(total: number): number {
  return Math.round(Math.pow(1 - total / 21, 1.6) * 100) / 10;
}

function getPSQIGrade(total: number): { grade: string; color: string } {
  if (total <= 2) return { grade: "S", color: "#059669" };
  if (total <= 5) return { grade: "A", color: "#10b981" };
  if (total <= 7) return { grade: "B", color: "#f59e0b" };
  if (total <= 10) return { grade: "C", color: "#f97316" };
  if (total <= 15) return { grade: "D", color: "#ef4444" };
  return { grade: "F", color: "#dc2626" };
}

// ── 날짜 포맷 유틸 ──
function formatDateKR(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

function calcDaysElapsed(startDate: string | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcDaysRemaining(trialEndDate: string | null): number {
  if (!trialEndDate) return 0;
  const end = new Date(trialEndDate);
  end.setHours(23, 59, 59, 999);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

// ── 동기부여 메시지 분기 (①~⑯ 전체 체험 기간) ──
type MotivationMessage = {
  lines: string[];
  cta: string;
  awardFooter: string;
};

function getMotivationMessage(
  participationDays: number,
  streak: number,
  daysElapsed: number,
  practicedToday: boolean,
  userName: string
): MotivationMessage {
  // trialDay: 1-indexed (체험 1일차 = daysElapsed 0)
  const trialDay = daysElapsed + 1;
  const isEarlyPhase = trialDay <= 3;

  // ════════════════════════════════════════
  // 연속 실천 (practicedToday && streak 기준)
  // ════════════════════════════════════════

  // ⑮ 장기 연속 실천 (4일차+, streak≥4)
  if (!isEarlyPhase && streak >= 4 && practicedToday) {
    return {
      lines:
        streak === participationDays
          ? [`${streak}일 연속 실천.`, `${userName}님의 웰니스 루틴이 자리잡고 있어요.`]
          : ["꾸준한 실천이 루틴이 되고 있어요.", `${userName}님의 웰니스 루틴이 자리잡고 있어요.`],
      cta: "나의 웰니스 기록 보기",
      awardFooter: "웰니스 루틴이 자리잡고 있어요",
    };
  }

  // ④ 3일 연속 실천 (1~3일차)
  if (isEarlyPhase && streak >= 3 && practicedToday) {
    return {
      lines: [
        "꾸준한 실천.",
        "이제 몸이 이 시간을 기다리기 시작합니다.",
        `${userName}님만의 웰니스 루틴이 만들어지고 있어요.`,
      ],
      cta: "나의 실천 기록 보기",
      awardFooter: "웰니스 루틴이 만들어지고 있어요",
    };
  }

  // ⑭ 연속 실천 중 (4일차+, streak 2~3)
  if (!isEarlyPhase && streak >= 2 && practicedToday) {
    return {
      lines:
        streak === participationDays
          ? [`${streak}일 연속, 몸이 달라지고 있어요.`, "꾸준함이 변화를 만듭니다."]
          : ["웰니스 루틴이 만들어지고 있어요.", "꾸준함이 변화를 만듭니다."],
      cta: "나의 실천 기록 보기",
      awardFooter: "꾸준함이 변화를 만듭니다",
    };
  }

  // ③ 2일 연속 실천 (1~3일차, ⑧ 늦은 시작+2일 연속 포함)
  if (isEarlyPhase && streak >= 2 && practicedToday) {
    return {
      lines: [
        "몸이 달라지고 있어요.",
        "습관은 이렇게 만들어집니다.",
        "내일도 이어가면, 작은 리듬이 생겨요.",
      ],
      cta: "나의 실천 기록 보기",
      awardFooter: "습관은 이렇게 만들어집니다",
    };
  }

  // ════════════════════════════════════════
  // 쉬다 돌아온 실천 (practicedToday, streak=1)
  // ════════════════════════════════════════

  // ⑤/⑬ 쉬었다가 돌아온 실천 (전체 기간 공통)
  if (participationDays >= 2 && streak === 1 && practicedToday) {
    return {
      lines: ["바쁜 하루 속에서도 다시 찾아주셨어요.", "지금 이어가면 충분합니다."],
      cta: "나의 실천 기록 보기",
      awardFooter: "다시 찾아주셨어요",
    };
  }

  // ════════════════════════════════════════
  // 첫 실천 (participation=1, streak=1, practicedToday)
  // ════════════════════════════════════════

  // ② 첫 실천 완료 (체험 1일차)
  if (participationDays === 1 && streak === 1 && practicedToday && trialDay === 1) {
    return {
      lines: [
        "첫 걸음을 내디뎠습니다.",
        "몸이 기억하기 시작했어요.",
        "내일도 15분, 이어가 볼까요?",
      ],
      cta: "오늘의 기록 확인하기",
      awardFooter: "몸이 기억하기 시작했어요",
    };
  }

  // ⑦/⑫ 늦은 첫 시작 (체험 2일차 이후 첫 실천)
  if (participationDays === 1 && streak === 1 && practicedToday && trialDay >= 2) {
    return {
      lines: [
        "첫 걸음을 내디뎠습니다.",
        "시작한 날이 1일차예요.",
        `지금부터가 ${userName}님의 여정입니다.`,
      ],
      cta: "오늘의 기록 확인하기",
      awardFooter: "시작한 날이 1일차예요",
    };
  }

  // ════════════════════════════════════════
  // 오늘 미실천 (!practicedToday)
  // ════════════════════════════════════════

  // ⑯ 꾸준한 실천자 쉬는 중 (4일차+, participation≥3)
  if (!isEarlyPhase && participationDays >= 3 && !practicedToday) {
    return {
      lines: [`${participationDays}일의 실천이 쌓여 있어요.`, "오늘도 이어가 볼까요?"],
      cta: "오늘의 솔루션 시작하기",
      awardFooter: `${participationDays}일의 실천이 쌓여 있어요`,
    };
  }

  // ⑥/⑪ 실천한 적 있으나 오늘은 아직 (전체 기간, participation 1~2)
  if (participationDays >= 1 && !practicedToday) {
    return {
      lines: ["지난번에 시작한 여정, 아직 열려 있어요.", "오늘 15분이면 다시 이어갈 수 있습니다."],
      cta: "오늘의 솔루션 시작하기",
      awardFooter: "지난번 실천이 몸에 남아 있어요",
    };
  }

  // ════════════════════════════════════════
  // 미참여 (participation=0)
  // ════════════════════════════════════════

  // ⑩ 미참여 후반 (6~7일차)
  if (participationDays === 0 && trialDay >= 6) {
    return {
      lines: ["아직 경험하지 못한 솔루션이 있어요.", "15분이면 충분합니다."],
      cta: "솔루션 경험해보기",
      awardFooter: "15분, 한 번의 시도로 변화는 시작됩니다",
    };
  }

  // ⑨ 미참여 중반 (4~5일차)
  if (participationDays === 0 && trialDay >= 4) {
    return {
      lines: ["아직 경험하지 못한 솔루션이 기다리고 있어요.", "지금 시작해도 충분합니다."],
      cta: "첫 번째 솔루션 시작하기",
      awardFooter: "오늘, 나를 위한 웰니스 15분을 만드세요",
    };
  }

  // ① 미실천 (1~3일차 fallback)
  return {
    lines: ["오늘이 시작이에요.", "하루 15분, 첫 번째 솔루션이 기다리고 있습니다."],
    cta: "첫 번째 솔루션 시작하기",
    awardFooter: "당신의 몸과 마음이 웰니스 솔루션을 기다립니다",
  };
}

// ── paid 전용: 주차 단계 판별 ──
type PaidPhase = "settling" | "growing" | "stable";

function getPaidPhase(weekNumber: number): PaidPhase {
  if (weekNumber <= 4) return "settling";
  if (weekNumber <= 12) return "growing";
  return "stable";
}

// ── paid 전용: 동기부여 메시지 (P-①~⑨) ──
function getPaidMotivationMessage(
  participationDays: number,
  streak: number,
  practicedToday: boolean,
  weekNumber: number,
  userName: string
): MotivationMessage {
  const phase = getPaidPhase(weekNumber);

  // P-① 장기 연속 실천 (streak≥7, practicedToday)
  if (streak >= 7 && practicedToday) {
    const lines =
      phase === "settling"
        ? [`${streak}일 연속 실천.`, "웰니스가 일상이 되고 있습니다."]
        : phase === "growing"
          ? [`${streak}일 연속.`, `${userName}님의 루틴이 빛나고 있어요.`]
          : [`${streak}일 연속.`, "이미 웰니스가 삶의 일부입니다."];
    return {
      lines,
      cta: "나의 웰니스 기록 보기",
      awardFooter: "웰니스가 일상이 되었어요",
    };
  }

  // P-② 중기 연속 실천 (streak 4~6, practicedToday)
  if (streak >= 4 && practicedToday) {
    const lines =
      phase === "settling"
        ? [
            `${streak}일 연속, 루틴이 자리잡고 있어요.`,
            `${userName}님의 선택이 변화를 만들고 있습니다.`,
          ]
        : ["꾸준한 실천이 깊어지고 있어요.", `${userName}님의 웰니스 루틴이 단단해지고 있습니다.`];
    return {
      lines,
      cta: "나의 웰니스 기록 보기",
      awardFooter: "꾸준함이 빛나고 있어요",
    };
  }

  // P-③ 단기 연속 실천 (streak 2~3, practicedToday)
  if (streak >= 2 && practicedToday) {
    const lines =
      streak === participationDays
        ? [`${streak}일 연속, 몸이 달라지고 있어요.`, "꾸준함이 변화를 만듭니다."]
        : ["다시 이어가는 리듬.", "꾸준함이 변화를 만듭니다."];
    return {
      lines,
      cta: "나의 실천 기록 보기",
      awardFooter: "꾸준함이 변화를 만듭니다",
    };
  }

  // P-④ 쉬다 돌아온 실천 (participation≥2, streak=1, practicedToday)
  if (participationDays >= 2 && streak === 1 && practicedToday) {
    return {
      lines: ["다시 돌아오셨군요.", "쉬어가는 것도 루틴의 일부입니다."],
      cta: "나의 실천 기록 보기",
      awardFooter: "다시 시작하는 것이 중요합니다",
    };
  }

  // P-⑤ 첫/초기 실천 (participation≤1, streak=1, practicedToday)
  if (streak === 1 && practicedToday) {
    const lines =
      phase === "settling"
        ? [
            `${userName}님의 여정이 계속되고 있어요.`,
            `이번 주도 ${userName}님의 웰니스를 함께합니다.`,
          ]
        : ["다시 시작하는 날이 새로운 1일차예요.", `지금부터가 ${userName}님의 여정입니다.`];
    return {
      lines,
      cta: "오늘의 기록 확인하기",
      awardFooter: "이어가는 것이 가장 큰 실천입니다",
    };
  }

  // P-⑥ 꾸준한 실천자 쉬는 중 (participation≥7, !practicedToday)
  if (participationDays >= 7 && !practicedToday) {
    const lines =
      phase === "settling"
        ? [`${participationDays}일의 실천이 쌓여 있어요.`, "오늘도 이어가 볼까요?"]
        : [
            `${participationDays}일의 웰니스가 ${userName}님 안에 있어요.`,
            "오늘도 15분, 이어가 볼까요?",
          ];
    return {
      lines,
      cta: "오늘의 솔루션 시작하기",
      awardFooter: `${participationDays}일의 실천이 빛나고 있어요`,
    };
  }

  // P-⑦ 중간 실천자 쉬는 중 (participation 3~6, !practicedToday)
  if (participationDays >= 3 && !practicedToday) {
    return {
      lines: ["지금까지의 실천은 사라지지 않아요.", "오늘 15분이면 다시 이어갈 수 있습니다."],
      cta: "오늘의 솔루션 시작하기",
      awardFooter: "실천의 감각이 남아 있어요",
    };
  }

  // P-⑧ 저참여 쉬는 중 (participation 1~2, !practicedToday)
  if (participationDays >= 1 && !practicedToday) {
    return {
      lines: ["지난번에 시작한 여정, 아직 열려 있어요.", "오늘 15분이면 다시 이어갈 수 있습니다."],
      cta: "오늘의 솔루션 시작하기",
      awardFooter: `${participationDays}일의 기록이 여기 있어요`,
    };
  }

  // P-⑨ 미참여 (participation=0, !practicedToday)
  const paidLines =
    phase === "settling"
      ? [`${userName}님을 위한 솔루션이 준비되어 있어요.`, "하루 15분, 시작해 볼까요?"]
      : ["아직 경험하지 못한 솔루션이 기다리고 있어요.", "오늘, 나를 위한 15분을 만들어보세요."];
  return {
    lines: paidLines,
    cta: "첫 번째 솔루션 시작하기",
    awardFooter: "당신의 웰니스 여정이 기다리고 있어요",
  };
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");
  const [subType, setSubType] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // ── free_trial 전용 상태 ──
  const [watchRecords, setWatchRecords] = useState<WatchRecord[]>([]);
  const [nextWeekContent, setNextWeekContent] = useState<{
    title: string;
    thumbnailUrl: string;
  } | null>(null);

  // ── 결제 정보 ──
  const [billingInfo, setBillingInfo] = useState<{
    planType: string;
    cardLast4: string;
    cardCompany: string;
    nextChargeDate: string;
    status: string;
  } | null>(null);

  // ── paid 전용: 현재/다음 주차 콘텐츠 ──
  const [paidCurrentWeek, setPaidCurrentWeek] = useState<{
    weekNumber: number;
    title: string;
    thumbnailUrl: string;
  } | null>(null);
  const [paidNextWeek, setPaidNextWeek] = useState<{
    weekNumber: number;
    title: string;
    thumbnailUrl: string;
  } | null>(null);

  // ── 웰니스 대시보드 카드 상태 ──
  const [selfCheckIntensity, setSelfCheckIntensity] = useState<number | null>(null);
  const [selfCheckGrade, setSelfCheckGrade] = useState<{
    grade: string;
    shortLabel: string;
    color: string;
  } | null>(null);
  const [psqiScore, setPsqiScore] = useState<number | null>(null);
  const [practiceDays, setPracticeDays] = useState({
    solution: 0,
    habit: 0,
    understanding: 0,
    total: 0,
    streak: 0,
    practicedToday: false,
  });

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }
    const name = getUserName();
    setUserName(name || "");

    // 구독 유형 확인
    async function loadSubType() {
      try {
        const sub = await getSubscription("autobalance");
        setSubscription(sub);
        setSubType(sub.subscriptionType);

        // 결제 정보 조회 (free_trial, paid 공통)
        const userToken = storage.getRaw("user_id_token");
        const authHeaders: Record<string, string> = userToken
          ? { Authorization: `Bearer ${userToken}` }
          : {};

        if (sub.subscriptionType === "free_trial" || sub.subscriptionType === "paid") {
          // 결제 정보 조회 (free_trial, paid 공통)
          try {
            const biRes = await fetch("/api/user/billing/info?programId=autobalance", {
              headers: authHeaders,
            });
            const biData = await biRes.json();
            if (biRes.ok && biData.found) setBillingInfo(biData);
          } catch (e) {
            console.warn("[Subscription] billing/info failed:", e);
          }
        }

        // free_trial / paid 공통 추가 데이터
        if (sub.subscriptionType === "free_trial" || sub.subscriptionType === "paid") {
          // 시청 기록
          const records = getWatchRecords("autobalance");
          setWatchRecords(records);

          // ── 웰니스 대시보드: 자가 체크 ──
          try {
            const scResult = await fetchAndHydrateSelfCheckResult();
            if (scResult) {
              const intensity = getSignalIntensity(scResult.categories);
              setSelfCheckIntensity(intensity);
              setSelfCheckGrade(getSignalGrade(intensity));
            }
          } catch (e) {
            console.warn("[Subscription] Self-check load failed:", e);
          }

          // ── 웰니스 대시보드: PSQI ──
          try {
            const psqiRes = await fetch("/api/user/psqi-result", {
              cache: "no-store",
              headers: authHeaders,
            });
            if (psqiRes.ok) {
              const psqiData = await psqiRes.json();
              const results = psqiData.results || psqiData.items || [];
              if (Array.isArray(results) && results.length > 0) {
                const latest = results[results.length - 1];
                setPsqiScore(latest.total ?? null);
              }
            }
          } catch (e) {
            console.warn("[Subscription] PSQI load failed:", e);
          }

          // ── 웰니스 대시보드: 실천일 계산 (AWS API) ──
          try {
            const prRes = await fetch("/api/user/practice-record", {
              cache: "no-store",
              headers: authHeaders,
            });
            const prData = await prRes.json();
            if (prRes.ok) {
              const items: { type: string; date: string }[] = prData.items || [];

              const solDays = new Set<string>();
              const habDays = new Set<string>();
              const undDays = new Set<string>();

              for (const item of items) {
                if (item.type === "solution") solDays.add(item.date);
                else if (item.type === "habit") habDays.add(item.date);
                else if (item.type === "understanding") undDays.add(item.date);
              }

              // 전체 실천일: 3종 중 하나라도 실천한 날
              const allDaysSet = new Set([...solDays, ...habDays, ...undDays]);

              // 로컬 시간 기준 날짜 문자열 (UTC 변환 방지)
              const toLocalDateStr = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

              // 연속 실천일 계산 (오늘부터 역순)
              let streak = 0;
              if (allDaysSet.size > 0) {
                const checkDate = new Date();
                checkDate.setHours(0, 0, 0, 0);
                const todayStr = toLocalDateStr(checkDate);
                if (!allDaysSet.has(todayStr)) {
                  checkDate.setDate(checkDate.getDate() - 1);
                }
                for (let i = 0; i < 365; i++) {
                  const dateStr = toLocalDateStr(checkDate);
                  if (allDaysSet.has(dateStr)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                  } else {
                    break;
                  }
                }
              }

              // 오늘 실천 여부 판별
              const todayForPracticeCheck = new Date();
              todayForPracticeCheck.setHours(0, 0, 0, 0);
              const didPracticeToday = allDaysSet.has(toLocalDateStr(todayForPracticeCheck));

              setPracticeDays({
                solution: solDays.size,
                habit: habDays.size,
                understanding: undDays.size,
                total: allDaysSet.size,
                streak,
                practicedToday: didPracticeToday,
              });
            }
          } catch (e) {
            console.warn("[Subscription] Practice days calc failed:", e);
          }

          // 콘텐츠 목록 조회 (free_trial: 2주차 프리뷰, paid: 현재/다음 주차)
          try {
            const res = await fetch("/api/public/balance/videos/autobalance", {
              cache: "no-store",
              headers: authHeaders,
            });
            if (res.ok) {
              const data = await res.json();
              const items: BalanceVideoItem[] = Array.isArray(data) ? data : (data?.items ?? []);

              if (sub.subscriptionType === "free_trial") {
                const week2 = items.find((v) => Number(v.weekNumber) === 2);
                if (week2) {
                  setNextWeekContent({
                    title: week2.title,
                    thumbnailUrl: week2.thumbnailKey ? makeThumbnailUrl(week2.thumbnailKey) : "",
                  });
                }
              }

              if (sub.subscriptionType === "paid") {
                const paidDays = calcDaysElapsed(sub.startDate);
                const currentWeek = Math.floor(paidDays / 7) + 1;

                const currentWeekVideo = items.find((v) => Number(v.weekNumber) === currentWeek);
                const nextWeekVideo = items.find((v) => Number(v.weekNumber) === currentWeek + 1);

                if (currentWeekVideo) {
                  setPaidCurrentWeek({
                    weekNumber: currentWeek,
                    title: currentWeekVideo.title,
                    thumbnailUrl: currentWeekVideo.thumbnailKey
                      ? makeThumbnailUrl(currentWeekVideo.thumbnailKey)
                      : "",
                  });
                }
                if (nextWeekVideo) {
                  setPaidNextWeek({
                    weekNumber: currentWeek + 1,
                    title: nextWeekVideo.title,
                    thumbnailUrl: nextWeekVideo.thumbnailKey
                      ? makeThumbnailUrl(nextWeekVideo.thumbnailKey)
                      : "",
                  });
                }
              }
            }
          } catch (e) {
            console.warn("[Subscription] Failed to load content:", e);
          }
        }
      } catch {
        setSubType("browser");
      } finally {
        setLoadingSub(false);
      }
    }
    loadSubType();
  }, [router]);

  // ── 활동 요약 (메모이제이션) ──
  const activity = useMemo(() => calcActivitySummary(watchRecords), [watchRecords]);

  // ── 체험 기간 계산 ──
  const daysElapsed = useMemo(
    () => (subscription ? calcDaysElapsed(subscription.startDate) : 0),
    [subscription]
  );
  const daysRemaining = useMemo(
    () => (subscription ? calcDaysRemaining(subscription.trialEndDate) : 0),
    [subscription]
  );

  // ── 동기부여 메시지 (전체 체험 기간) ──
  const motivation = useMemo(
    () =>
      getMotivationMessage(
        practiceDays.total,
        practiceDays.streak,
        daysElapsed,
        practiceDays.practicedToday,
        userName || "회원"
      ),
    [practiceDays, daysElapsed, userName]
  );

  // ── paid 전용: 주차 계산 ──
  const weekNumber = useMemo(
    () =>
      subscription && subType === "paid"
        ? Math.floor(calcDaysElapsed(subscription.startDate) / 7) + 1
        : 0,
    [subscription, subType]
  );

  // ── paid 전용: 동기부여 메시지 ──
  const paidMotivation = useMemo(
    () =>
      subType === "paid"
        ? getPaidMotivationMessage(
            practiceDays.total,
            practiceDays.streak,
            practiceDays.practicedToday,
            weekNumber,
            userName || "회원"
          )
        : null,
    [subType, practiceDays, weekNumber, userName]
  );

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
          <h1 className={styles.pageTitle}>구독 관리</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* ── 로딩 중 ── */}
        {loadingSub && (
          <section className={styles.welcomeSection}>
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>
              불러오는 중...
            </p>
          </section>
        )}

        {/* ── browser / browser_selected: 무료 체험 유도 ── */}
        {!loadingSub && (subType === "browser" || subType === "browser_selected") && (
          <>
            <section className={styles.welcomeSection}>
              <h2 className={styles.welcomeTitle}>
                하루 15분,
                <br />
                당신을 위한{" "}
                <span className={styles.welcomeAccent}>&lsquo;맞춤 웰니스 솔루션&rsquo;</span>
              </h2>

              <button className={styles.trialBox} onClick={() => router.push("/home/pricing")}>
                <span className={styles.trialText}>7일 무료 체험</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.trialArrow}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              <p className={styles.trialGuarantee}>7일 무료 체험 중 언제든 취소 가능</p>
            </section>

            <section className={styles.benefitSection}>
              <p className={styles.benefitText}>
                힐에코의 맞춤 웰니스 3세트가
                <br />
                매주 <span className={styles.benefitName}>{userName || "회원"}</span>님을
                찾아갑니다.
              </p>

              <div className={styles.benefitImages}>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/solutions.png"
                    alt="위클리 솔루션"
                    width={300}
                    height={300}
                    className={styles.benefitImage}
                  />
                  <span className={styles.benefitImageLabel}>위클리 솔루션</span>
                </div>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/healing_recipe_square.png"
                    alt="위클리 해빗"
                    width={300}
                    height={300}
                    className={styles.benefitImage}
                  />
                  <span className={styles.benefitImageLabel}>위클리 해빗</span>
                </div>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/Ocean_of_Understanding_crop.png"
                    alt="이해의 바다"
                    width={300}
                    height={300}
                    className={styles.benefitImage}
                  />
                  <span className={styles.benefitImageLabel}>이해의 바다</span>
                </div>
              </div>
            </section>

            <section className={styles.motivationSection}>
              <p className={styles.motivationText}>
                <span className={styles.motivationName}>{userName || "회원"}</span>님의
                <br />
                작은 시작이 큰 변화를 만듭니다.
              </p>
              <button className={styles.ctaBtn} onClick={() => router.push("/home/pricing")}>
                지금, 나를 위한 변화 시작하기
              </button>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            free_trial: 무료 체험 중 구독 관리 (빌링 모델)
            ══════════════════════════════════════════════════════ */}
        {!loadingSub && subType === "free_trial" && subscription && (
          <>
            {/* ── 섹션 1: 구독 상태 카드 ── */}
            <section className={styles.ftStatusSection}>
              <div className={styles.ftStatusBadge}>
                <span className={styles.ftStatusDot} />
                무료 체험 중
              </div>

              <p className={styles.ftProgramName}>{getProgramName(subscription?.programId)}</p>

              {/* 개인 웰니스 대시보드 카드 */}
              <div className={styles.ftDashboard}>
                {/* 측정 카드 2장 */}
                <div className={styles.ftDashboardCards}>
                  {/* 자율신경 자가 체크 */}
                  <div className={styles.ftDashboardCard}>
                    <span className={styles.ftDashboardIcon}>🌀</span>
                    <span className={styles.ftDashboardLabel}>불균형 신호</span>
                    {selfCheckIntensity !== null ? (
                      <>
                        <span
                          className={styles.ftDashboardScore}
                          style={{ color: selfCheckGrade?.color || "#374151" }}
                        >
                          {selfCheckIntensity}%
                        </span>
                        <span className={styles.ftDashboardGrade}>
                          {selfCheckGrade?.grade || "-"}등급
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.ftDashboardEmpty}>미검사</span>
                        <button
                          className={styles.ftDashboardCheckBtn}
                          onClick={() =>
                            router.push("/wellness/solution/self-check?from=subscription")
                          }
                        >
                          지금 검사하기
                        </button>
                      </>
                    )}
                  </div>

                  {/* PSQI 수면의 질 */}
                  <div className={styles.ftDashboardCard}>
                    <span className={styles.ftDashboardIcon}>🌙</span>
                    <span className={styles.ftDashboardLabel}>수면 품질</span>
                    {psqiScore !== null ? (
                      <>
                        <span
                          className={styles.ftDashboardScore}
                          style={{ color: getPSQIGrade(psqiScore).color }}
                        >
                          {toScore10(psqiScore)}
                          <span className={styles.ftDashboardScoreUnit}>/10</span>
                        </span>
                        <span className={styles.ftDashboardGrade}>
                          {getPSQIGrade(psqiScore).grade}등급
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.ftDashboardEmpty}>미검사</span>
                        <button
                          className={styles.ftDashboardCheckBtn}
                          onClick={() => router.push("/wellness/psqi?from=subscription")}
                        >
                          지금 검사하기
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 웰니스 실천일 — 미니멀 상장 */}
                <div className={styles.ftAwardCard}>
                  <span className={styles.ftAwardLabel}>WELLNESS CERTIFICATE</span>

                  {/* 배지: 물결 원 + 숫자 */}
                  <div className={styles.ftAwardBadge}>
                    <svg
                      className={styles.ftAwardBadgeSvg}
                      viewBox="0 0 120 120"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={(() => {
                          const cx = 60,
                            cy = 60,
                            points = 24,
                            rOuter = 54,
                            rInner = 48;
                          let d = "";
                          for (let i = 0; i < points; i++) {
                            const aOuter = (i * 2 * Math.PI) / points - Math.PI / 2;
                            const aInner = ((i + 0.5) * 2 * Math.PI) / points - Math.PI / 2;
                            const xO = cx + rOuter * Math.cos(aOuter);
                            const yO = cy + rOuter * Math.sin(aOuter);
                            const xI = cx + rInner * Math.cos(aInner);
                            const yI = cy + rInner * Math.sin(aInner);
                            d += i === 0 ? `M${xO},${yO}` : `L${xO},${yO}`;
                            d += `Q${cx + (rOuter - 1) * Math.cos((aOuter + aInner) / 2)},${cy + (rOuter - 1) * Math.sin((aOuter + aInner) / 2)} ${xI},${yI}`;
                          }
                          return d + "Z";
                        })()}
                        fill="url(#badgeFill)"
                      />
                      <defs>
                        <linearGradient
                          id="badgeFill"
                          x1="60"
                          y1="6"
                          x2="60"
                          y2="114"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#00d6f5" />
                          <stop offset="100%" stopColor="#8a2be2" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className={styles.ftAwardBadgeText}>
                      <span className={styles.ftAwardNum}>{practiceDays.total}</span>
                    </div>
                  </div>

                  {/* 리본 배너: 웰니스 실천일 */}
                  <div className={styles.ftAwardRibbon}>
                    <span className={styles.ftAwardRibbonText}>웰니스 실천일</span>
                  </div>

                  {/* 프로그램 참여 태그 */}
                  <div className={styles.ftAwardTags}>
                    {practiceDays.solution > 0 && (
                      <span className={styles.ftAwardTag}>웰니스 솔루션</span>
                    )}
                    {practiceDays.habit > 0 && (
                      <span className={styles.ftAwardTag}>위클리 해빗</span>
                    )}
                    {practiceDays.understanding > 0 && (
                      <span className={styles.ftAwardTag}>이해의 바다</span>
                    )}
                    {practiceDays.total === 0 && (
                      <span className={styles.ftAwardTag}>첫 실천을 시작해보세요</span>
                    )}
                  </div>

                  <span className={styles.ftAwardFooter}>{motivation.awardFooter}</span>
                </div>
              </div>

              {/* 결제 예정 안내 박스 */}
              <div className={styles.ftBillingInfo}>
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>참여 중인 웰니스 솔루션</span>
                  <span className={styles.ftBillingValue}>
                    {getProgramName(subscription?.programId)}
                  </span>
                </div>
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>체험 종료</span>
                  <span className={styles.ftBillingValue}>
                    {formatDateKR(subscription.trialEndDate)}
                  </span>
                </div>
                {billingInfo?.cardLast4 && (
                  <div className={styles.ftBillingRow}>
                    <span className={styles.ftBillingKey}>결제 수단</span>
                    <span
                      className={styles.ftBillingValue}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <CardBrandIcon company={billingInfo.cardCompany} />
                      {billingInfo.cardCompany} **** {billingInfo.cardLast4}
                      <button
                        className={styles.ftBillingChangeBtn}
                        onClick={() => router.push("/mypage/settings/subscription/change-payment")}
                      >
                        변경
                      </button>
                    </span>
                  </div>
                )}
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>결제 예정일</span>
                  <span className={styles.ftBillingValue}>
                    {billingInfo?.nextChargeDate
                      ? formatDateKR(billingInfo.nextChargeDate)
                      : formatDateKR(subscription.trialEndDate)}
                  </span>
                </div>
              </div>

              <p className={styles.ftBillingNote}>체험 기간 중에는 요금이 청구되지 않습니다.</p>
            </section>

            {/* ── 섹션 2: 나의 활동 요약 ── */}
            <section className={styles.ftActivitySection}>
              {practiceDays.total === 0 ? (
                <>
                  {/* 패턴 ① 미실천 */}
                  <div className={styles.ftEmptyState}>
                    <p className={styles.ftEmptyMessage}>
                      {motivation.lines.map((line, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  <button
                    className={styles.ftSolutionBtn}
                    onClick={() => router.push(getCtaRoute(motivation.cta))}
                  >
                    <span className={styles.ftSolutionBtnText}>{motivation.cta}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.ftSolutionBtnArrow}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  {/* 동기부여 메시지 (패턴 ②~⑯) */}
                  <div className={styles.ftMotivBlock}>
                    <p className={styles.ftMotivText}>
                      {motivation.lines.map((line, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  {/* CTA: 패턴별 동적 텍스트 */}
                  <button
                    className={styles.ftSolutionBtn}
                    onClick={() => router.push(getCtaRoute(motivation.cta))}
                  >
                    <span className={styles.ftSolutionBtnText}>{motivation.cta}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.ftSolutionBtnArrow}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
            </section>

            {/* ── 섹션 3: 곧 열리는 다음 여정 ── */}
            <section className={styles.ftNextSection}>
              <p className={styles.ftNextTitle}>곧 열리는 다음 여정</p>

              <div className={styles.ftNextCards}>
                {/* 2주차 솔루션 카드 (블러 + 잠금) */}
                <div className={styles.ftNextCard}>
                  <div className={styles.ftNextCardThumb}>
                    {nextWeekContent?.thumbnailUrl ? (
                      <Image
                        src={nextWeekContent.thumbnailUrl}
                        alt="2주차 솔루션"
                        width={400}
                        height={225}
                        className={styles.ftNextCardImage}
                      />
                    ) : (
                      <div className={styles.ftNextCardPlaceholder} />
                    )}
                    <div className={styles.ftNextCardLock}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.ftNextCardInfo}>
                    <span className={styles.ftNextCardBadge}>2주차</span>
                    <span className={styles.ftNextCardTitle}>
                      {nextWeekContent?.title || "2주차 솔루션"}
                    </span>
                  </div>
                </div>

                {/* 수면 분석 리포트 카드 */}
                <div className={styles.ftNextCard}>
                  <div className={styles.ftNextCardThumb}>
                    <div className={styles.ftNextCardPlaceholderIcon}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    </div>
                    <div className={styles.ftNextCardLock}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.ftNextCardInfo}>
                    <span className={styles.ftNextCardBadge}>리포트</span>
                    <span className={styles.ftNextCardTitle}>수면 분석 리포트</span>
                  </div>
                </div>
              </div>

              <p className={styles.ftNextNote}>체험 후 자동으로 이용 가능</p>
            </section>

            {/* ── 섹션 4: 체험 해지 ── */}
            <section className={styles.ftCancelSection}>
              <p className={styles.ftCancelDesc}>
                체험을 해지하면 {formatDateKR(subscription.trialEndDate)}까지 모든 콘텐츠를 이용할
                수 있으며, 이후 자동 결제가 취소됩니다.
              </p>
              <button
                className={styles.ftCancelBtn}
                onClick={() => {
                  // TODO: 해지 플로우 연결
                  router.push("/mypage/settings/subscription/cancel");
                }}
              >
                체험 해지하기
              </button>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            paid: 유료 구독 중 — 전체 구독 관리
            ══════════════════════════════════════════════════════ */}
        {!loadingSub && subType === "paid" && subscription && (
          <>
            {/* ── 섹션 1: 구독 상태 카드 + 웰니스 대시보드 + 결제 정보 ── */}
            <section className={styles.ftStatusSection}>
              <div
                className={styles.ftStatusBadge}
                style={{ background: "rgba(16,185,129,0.1)", color: "#059669" }}
              >
                <span className={styles.ftStatusDot} style={{ background: "#059669" }} />
                구독 중
              </div>

              <p className={styles.ftProgramName}>{getProgramName(subscription?.programId)}</p>

              {/* 개인 웰니스 대시보드 카드 */}
              <div className={styles.ftDashboard}>
                {/* 측정 카드 2장 */}
                <div className={styles.ftDashboardCards}>
                  {/* 자율신경 자가 체크 */}
                  <div className={styles.ftDashboardCard}>
                    <span className={styles.ftDashboardIcon}>🌀</span>
                    <span className={styles.ftDashboardLabel}>불균형 신호</span>
                    {selfCheckIntensity !== null ? (
                      <>
                        <span
                          className={styles.ftDashboardScore}
                          style={{ color: selfCheckGrade?.color || "#374151" }}
                        >
                          {selfCheckIntensity}%
                        </span>
                        <span className={styles.ftDashboardGrade}>
                          {selfCheckGrade?.grade || "-"}등급
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.ftDashboardEmpty}>미검사</span>
                        <button
                          className={styles.ftDashboardCheckBtn}
                          onClick={() =>
                            router.push("/wellness/solution/self-check?from=subscription")
                          }
                        >
                          지금 검사하기
                        </button>
                      </>
                    )}
                  </div>

                  {/* PSQI 수면의 질 */}
                  <div className={styles.ftDashboardCard}>
                    <span className={styles.ftDashboardIcon}>🌙</span>
                    <span className={styles.ftDashboardLabel}>수면 품질</span>
                    {psqiScore !== null ? (
                      <>
                        <span
                          className={styles.ftDashboardScore}
                          style={{ color: getPSQIGrade(psqiScore).color }}
                        >
                          {toScore10(psqiScore)}
                          <span className={styles.ftDashboardScoreUnit}>/10</span>
                        </span>
                        <span className={styles.ftDashboardGrade}>
                          {getPSQIGrade(psqiScore).grade}등급
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.ftDashboardEmpty}>미검사</span>
                        <button
                          className={styles.ftDashboardCheckBtn}
                          onClick={() => router.push("/wellness/psqi?from=subscription")}
                        >
                          지금 검사하기
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 웰니스 실천일 — 미니멀 상장 */}
                <div className={styles.ftAwardCard}>
                  <span className={styles.ftAwardLabel}>WELLNESS CERTIFICATE</span>

                  {/* 배지: 물결 원 + 숫자 */}
                  <div className={styles.ftAwardBadge}>
                    <svg
                      className={styles.ftAwardBadgeSvg}
                      viewBox="0 0 120 120"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={(() => {
                          const cx = 60,
                            cy = 60,
                            points = 24,
                            rOuter = 54,
                            rInner = 48;
                          let d = "";
                          for (let i = 0; i < points; i++) {
                            const aOuter = (i * 2 * Math.PI) / points - Math.PI / 2;
                            const aInner = ((i + 0.5) * 2 * Math.PI) / points - Math.PI / 2;
                            const xO = cx + rOuter * Math.cos(aOuter);
                            const yO = cy + rOuter * Math.sin(aOuter);
                            const xI = cx + rInner * Math.cos(aInner);
                            const yI = cy + rInner * Math.sin(aInner);
                            d += i === 0 ? `M${xO},${yO}` : `L${xO},${yO}`;
                            d += `Q${cx + (rOuter - 1) * Math.cos((aOuter + aInner) / 2)},${cy + (rOuter - 1) * Math.sin((aOuter + aInner) / 2)} ${xI},${yI}`;
                          }
                          return d + "Z";
                        })()}
                        fill="url(#badgeFillPaid)"
                      />
                      <defs>
                        <linearGradient
                          id="badgeFillPaid"
                          x1="60"
                          y1="6"
                          x2="60"
                          y2="114"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#00d6f5" />
                          <stop offset="100%" stopColor="#8a2be2" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className={styles.ftAwardBadgeText}>
                      <span className={styles.ftAwardNum}>{practiceDays.total}</span>
                    </div>
                  </div>

                  {/* 리본 배너: 웰니스 실천일 */}
                  <div className={styles.ftAwardRibbon}>
                    <span className={styles.ftAwardRibbonText}>웰니스 실천일</span>
                  </div>

                  {/* 프로그램 참여 태그 */}
                  <div className={styles.ftAwardTags}>
                    {practiceDays.solution > 0 && (
                      <span className={styles.ftAwardTag}>웰니스 솔루션</span>
                    )}
                    {practiceDays.habit > 0 && (
                      <span className={styles.ftAwardTag}>위클리 해빗</span>
                    )}
                    {practiceDays.understanding > 0 && (
                      <span className={styles.ftAwardTag}>이해의 바다</span>
                    )}
                    {practiceDays.total === 0 && (
                      <span className={styles.ftAwardTag}>첫 실천을 시작해보세요</span>
                    )}
                  </div>

                  <span className={styles.ftAwardFooter}>{paidMotivation?.awardFooter || ""}</span>
                </div>
              </div>

              {/* 결제 정보 박스 */}
              <div className={styles.ftBillingInfo}>
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>참여 중인 웰니스 솔루션</span>
                  <span className={styles.ftBillingValue}>
                    {getProgramName(subscription?.programId)}
                  </span>
                </div>
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>현재 주차</span>
                  <span className={styles.ftBillingValue}>{weekNumber}주차</span>
                </div>
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>구독 시작일</span>
                  <span className={styles.ftBillingValue}>
                    {formatDateKR(subscription.startDate)}
                  </span>
                </div>
                {billingInfo?.cardLast4 && (
                  <div className={styles.ftBillingRow}>
                    <span className={styles.ftBillingKey}>결제 수단</span>
                    <span
                      className={styles.ftBillingValue}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <CardBrandIcon company={billingInfo.cardCompany} />
                      {billingInfo.cardCompany} **** {billingInfo.cardLast4}
                      <button
                        className={styles.ftBillingChangeBtn}
                        onClick={() => router.push("/mypage/settings/subscription/change-payment")}
                      >
                        변경
                      </button>
                    </span>
                  </div>
                )}
                <div className={styles.ftBillingRow}>
                  <span className={styles.ftBillingKey}>다음 결제 예정일</span>
                  <span className={styles.ftBillingValue}>
                    {billingInfo?.nextChargeDate ? formatDateKR(billingInfo.nextChargeDate) : "—"}
                  </span>
                </div>
              </div>

              <p className={styles.ftBillingNote}>다음 결제일에 자동으로 갱신됩니다.</p>
            </section>

            {/* ── 섹션 2: 나의 활동 요약 ── */}
            <section className={styles.ftActivitySection}>
              {practiceDays.total === 0 ? (
                <>
                  <div className={styles.ftEmptyState}>
                    <p className={styles.ftEmptyMessage}>
                      {paidMotivation?.lines.map((line, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  <button
                    className={styles.ftSolutionBtn}
                    onClick={() =>
                      router.push(getCtaRoute(paidMotivation?.cta || "솔루션 시작하기"))
                    }
                  >
                    <span className={styles.ftSolutionBtnText}>
                      {paidMotivation?.cta || "솔루션 시작하기"}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.ftSolutionBtnArrow}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.ftMotivBlock}>
                    <p className={styles.ftMotivText}>
                      {paidMotivation?.lines.map((line, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {line}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  <button
                    className={styles.ftSolutionBtn}
                    onClick={() =>
                      router.push(getCtaRoute(paidMotivation?.cta || "솔루션 이어보기"))
                    }
                  >
                    <span className={styles.ftSolutionBtnText}>
                      {paidMotivation?.cta || "솔루션 이어보기"}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.ftSolutionBtnArrow}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
            </section>

            {/* ── 섹션 3: 나의 여정 ── */}
            <section className={styles.ftNextSection}>
              <p className={styles.ftNextTitle}>나의 여정</p>

              <div className={styles.ftNextCards}>
                {/* 현재 주차 카드 (잠금 해제, 진행 중) */}
                {paidCurrentWeek && (
                  <div className={styles.ftNextCard}>
                    <div className={styles.ftNextCardThumb}>
                      {paidCurrentWeek.thumbnailUrl ? (
                        <Image
                          src={paidCurrentWeek.thumbnailUrl}
                          alt={`${paidCurrentWeek.weekNumber}주차 솔루션`}
                          width={400}
                          height={225}
                          className={styles.ftNextCardImageUnlocked}
                        />
                      ) : (
                        <div className={styles.ftNextCardPlaceholder} />
                      )}
                    </div>
                    <div className={styles.ftNextCardInfo}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className={styles.ftNextCardBadgeActive}>
                          {paidCurrentWeek.weekNumber}주차
                        </span>
                        <span className={styles.ftNextCardProgress}>진행 중</span>
                      </div>
                      <span className={styles.ftNextCardTitle}>{paidCurrentWeek.title}</span>
                    </div>
                  </div>
                )}

                {/* 다음 주차 카드 (잠금) */}
                {paidNextWeek && (
                  <div className={styles.ftNextCard}>
                    <div className={styles.ftNextCardThumb}>
                      {paidNextWeek.thumbnailUrl ? (
                        <Image
                          src={paidNextWeek.thumbnailUrl}
                          alt={`${paidNextWeek.weekNumber}주차 솔루션`}
                          width={400}
                          height={225}
                          className={styles.ftNextCardImage}
                        />
                      ) : (
                        <div className={styles.ftNextCardPlaceholder} />
                      )}
                      <div className={styles.ftNextCardLock}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                    </div>
                    <div className={styles.ftNextCardInfo}>
                      <span className={styles.ftNextCardBadge}>{paidNextWeek.weekNumber}주차</span>
                      <span className={styles.ftNextCardTitle}>{paidNextWeek.title}</span>
                    </div>
                  </div>
                )}

                {/* 수면 분석 리포트 카드 */}
                <div className={styles.ftNextCard}>
                  <div className={styles.ftNextCardThumb}>
                    <div className={styles.ftNextCardPlaceholderIcon}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    </div>
                    <div className={styles.ftNextCardLock}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.ftNextCardInfo}>
                    <span className={styles.ftNextCardBadge}>리포트</span>
                    <span className={styles.ftNextCardTitle}>수면 분석 리포트</span>
                  </div>
                </div>
              </div>

              <p className={styles.ftNextNote}>매주 새로운 솔루션이 열립니다</p>
            </section>

            {/* ── 섹션 4: 구독 해지 ── */}
            <section className={styles.ftCancelSection}>
              <p className={styles.ftCancelDesc}>
                구독을 해지하면 현재 결제 주기 종료일
                {billingInfo?.nextChargeDate ? `(${formatDateKR(billingInfo.nextChargeDate)})` : ""}
                까지 모든 콘텐츠를 이용할 수 있으며, 이후 자동 결제가 취소됩니다.
              </p>
              <button
                className={styles.ftCancelBtn}
                onClick={() => {
                  router.push("/mypage/settings/subscription/cancel");
                }}
              >
                구독 해지하기
              </button>
            </section>
          </>
        )}

        {/* ── paid_stopped / free_stopped: 추후 설계 ── */}
        {!loadingSub && (subType === "paid_stopped" || subType === "free_stopped") && (
          <section className={styles.welcomeSection}>
            <p style={{ textAlign: "center", color: "#374151", fontSize: 15, padding: "40px 0" }}>
              구독 관리 페이지는 준비 중입니다.
            </p>
          </section>
        )}
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
