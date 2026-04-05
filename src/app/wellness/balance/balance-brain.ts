// src/app/wellness/balance/balance-brain.ts
// =======================================================
// Heal Echo Balance 전용 "주차별 잠금 / 오픈" 뇌(Brain)
// - 아직 AWS, DynamoDB, Lambda 와는 연결하지 않고
//   순수 계산용 함수만 제공합니다.
// - 나중에 DynamoDB에서 가져온 데이터만 이 함수에 넣어주면 됩니다.
// =======================================================

import type {
  WeeklyVideoConfig,
  PlayEvent,
  WeekComputedState,
  BalanceState,
} from "@/types/balance";
import type { UserSubscription } from "@/types/subscription";

// 내부에서만 사용할 Date 도우미
function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * 주차별 잠금/오픈 Brain
 *
 * 규칙 요약:
 * 1) 각 주차 영상은 "자기 오픈일을 Day 1"로 보고 7일 동안 누적 3회 시청하면 조건 충족.
 * 2) 7일 안에 3회 이상 시청했다면 Day 8(=오픈 후 7일 경과 시점)에 다음 영상 오픈.
 * 3) 7일 이전에 이미 3회를 채워도, 다음 영상은 즉시가 아니라 Day 8에 오픈.
 * 4) 7일이 지나도 3회를 못 채우면 잠금 유지. 이후 3회를 채운 순간 즉시 다음 영상 오픈.
 * 5) 현재 영상은 다음 영상이 열려도 계속 시청 가능.
 * 6) 현재 영상은 "다다음 영상이 오픈되는 시점"에 잠금.
 * 7) 무료체험 7일 동안은 "현재 영상"과 "다음 영상" 썸네일만 노출.
 *
 * @param weeklyVideos   주차별 영상 기본 설정 (주차/영상ID 목록)
 * @param playEvents     사용자의 시청 이벤트 목록
 * @param programStartDate   사용자가 이 프로그램(Balance)을 시작한 날짜 (Week 1 오픈일) - ISO
 * @param subscription   구독 정보 (중앙 타입 UserSubscription 사용)
 * @param todayInput     (선택) 오늘 날짜. 테스트용으로 넣을 수 있고, 기본값은 new Date()
 */
export function calculateBalanceState(
  weeklyVideos: WeeklyVideoConfig[],
  playEvents: PlayEvent[],
  programStartDate: string,
  subscription: UserSubscription,
  todayInput?: Date
): BalanceState {
  const today = todayInput ?? new Date();

  // 1) 주차 정보를 weekNumber 기준으로 정렬
  const weeksSorted = [...weeklyVideos].sort((a, b) => a.weekNumber - b.weekNumber);

  // 2) 영상별 시청 이벤트를 Date 배열로 정리
  const eventsByVideo = new Map<string, Date[]>();

  for (const ev of playEvents) {
    if (!ev.playedAt) continue;
    const t = new Date(ev.playedAt);
    if (Number.isNaN(t.getTime())) continue;

    const list = eventsByVideo.get(ev.videoId) ?? [];
    list.push(t);
    eventsByVideo.set(ev.videoId, list);
  }

  // 각 영상별 이벤트를 시간 순으로 정렬
  for (const list of eventsByVideo.values()) {
    list.sort((a, b) => a.getTime() - b.getTime());
  }

  // 3) Week 1 의 오픈일은 programStartDate 로 고정
  let previousNextOpen: Date | null = new Date(programStartDate);

  // 1차 계산 결과(내부용)
  const intermediate = weeksSorted.map(
    (
      week
    ): {
      weekNumber: number;
      videoId: string;
      openAt: Date | null;
      nextWeekOpenAt: Date | null;
      playsTotal: number;
      playsWithin7: number;
      isRequirementMetWithin7Days: boolean;
    } => {
      const openAt = previousNextOpen;

      // 이전 주차가 아직 조건 미충족이라 이 주차가 열리지 못한 상태
      if (!openAt) {
        previousNextOpen = null; // 이후 주차들도 모두 막힘
        return {
          weekNumber: week.weekNumber,
          videoId: week.videoId,
          openAt: null,
          nextWeekOpenAt: null,
          playsTotal: 0,
          playsWithin7: 0,
          isRequirementMetWithin7Days: false,
        };
      }

      const windowEnd = addDays(openAt, 7); // Day 8 기준점
      const allEvents = eventsByVideo.get(week.videoId) ?? [];

      // 오픈된 이후의 모든 시청 기록
      const playsFromOpen = allEvents.filter((t) => t.getTime() >= openAt.getTime());

      // 오픈일 ~ 7일 동안의 시청 기록
      const playsWithin7 = playsFromOpen.filter((t) => t.getTime() < windowEnd.getTime());

      const playsTotal = playsFromOpen.length;

      let nextWeekOpenAt: Date | null = null;
      let isRequirementMetWithin7Days = false;

      // 규칙 2 & 3: 7일 안에 3회 이상 → Day 8 에 다음 영상 오픈
      if (playsWithin7.length >= 3) {
        isRequirementMetWithin7Days = true;
        nextWeekOpenAt = windowEnd;
      }
      // 규칙 4: 7일 지나도 3회를 못 채웠다면, 이후 3회를 채우는 순간 즉시 다음 영상 오픈
      else if (playsTotal >= 3) {
        // open 이후 3번째 시청 시점을 찾는다.
        const thirdPlay = playsFromOpen[2]; // 0,1,2 번째 = 3번째
        nextWeekOpenAt = thirdPlay;
      } else {
        // 아직 3회 미만 → 다음 주차는 아직 잠김
        nextWeekOpenAt = null;
      }

      previousNextOpen = nextWeekOpenAt;

      return {
        weekNumber: week.weekNumber,
        videoId: week.videoId,
        openAt,
        nextWeekOpenAt,
        playsTotal,
        playsWithin7: playsWithin7.length,
        isRequirementMetWithin7Days,
      };
    }
  );

  // 4) 다다음 주차 오픈 시점(=lockAt)을 계산
  const weekStatesWithLock = intermediate.map((w, idx, arr) => {
    const openAt = w.openAt;
    const nextWeekOpenAt = w.nextWeekOpenAt;

    // 다다음 주차의 openAt 이 "현재 주차의 lockAt"
    const weekPlus2 = arr[idx + 2];
    const lockAt = weekPlus2?.openAt ?? null;

    // 오늘 기준으로 오픈 여부/잠금 여부 계산
    const isOpenToday =
      !!openAt &&
      openAt.getTime() <= today.getTime() &&
      (!lockAt || lockAt.getTime() > today.getTime());

    const isLockedToday = !openAt || (lockAt !== null && lockAt.getTime() <= today.getTime());

    return {
      weekNumber: w.weekNumber,
      videoId: w.videoId,
      openAt,
      nextWeekOpenAt,
      lockAt,
      isOpenToday,
      isLockedToday,
      playsTotal: w.playsTotal,
      playsWithin7: w.playsWithin7,
      isRequirementMetWithin7Days: w.isRequirementMetWithin7Days,
    };
  });

  // 5) "현재 주차" 결정 (오늘 기준 가장 마지막으로 열린, 아직 잠기지 않은 주차)
  let currentWeekNumber: number | null = null;
  for (const w of weekStatesWithLock) {
    if (w.isOpenToday && !w.isLockedToday) {
      currentWeekNumber = w.weekNumber;
    }
  }
  // 아직 아무 것도 안 열린 경우 → openAt 이 있는 가장 첫 주차 사용
  if (currentWeekNumber === null) {
    const firstOpened = weekStatesWithLock.find((w) => !!w.openAt);
    currentWeekNumber = firstOpened ? firstOpened.weekNumber : null;
  }

  // 6) role(과거/현재/다음/미래잠김) 계산
  const withRoles = weekStatesWithLock.map((w) => {
    let role: WeekComputedState["role"] = "futureLocked";

    if (!w.openAt || w.openAt.getTime() > today.getTime()) {
      role = "futureLocked";
    } else if (w.isLockedToday) {
      role = "past";
    } else if (w.weekNumber === currentWeekNumber) {
      role = "current";
    } else if (currentWeekNumber !== null && w.weekNumber === currentWeekNumber + 1) {
      role = "next";
    } else if (currentWeekNumber !== null && w.weekNumber < currentWeekNumber) {
      role = "past";
    } else {
      role = "futureLocked";
    }

    return { ...w, role };
  });

  // 7) 무료 체험에 따른 썸네일 노출 제어
  const isInFreeTrial =
    subscription.subscriptionType === "free_trial" &&
    subscription.trialEndDate &&
    today.getTime() <= new Date(subscription.trialEndDate).getTime();

  const finalWeeks: WeekComputedState[] = withRoles.map((w) => {
    let isVisibleToday: boolean;

    if (!isInFreeTrial) {
      // 유료/정식 사용자: 열려 있는 주차만 우선 노출
      isVisibleToday = !!w.openAt && w.openAt.getTime() <= today.getTime();
    } else {
      // 무료 체험: "현재 주차" + "다음 주차"만 노출
      if (w.role === "current" || w.role === "next") {
        isVisibleToday = true;
      } else {
        isVisibleToday = false;
      }
    }

    // Date → ISO 문자열로 변환해서 React/페이지에서 다루기 쉽게 만든다.
    const toISO = (d: Date | null) => (d ? d.toISOString() : null);

    return {
      weekNumber: w.weekNumber,
      videoId: w.videoId,
      openAt: toISO(w.openAt),
      nextWeekOpenAt: toISO(w.nextWeekOpenAt),
      lockAt: toISO(w.lockAt),
      isOpenToday: w.isOpenToday,
      isLockedToday: w.isLockedToday,
      isVisibleToday,
      role: w.role,
      playsTotal: w.playsTotal,
      playsWithinFirst7Days: w.playsWithin7,
      isRequirementMetWithin7Days: w.isRequirementMetWithin7Days,
    };
  });

  return {
    today: today.toISOString(),
    currentWeekNumber,
    weeks: finalWeeks,
  };
}

// =======================================================
// 사용 예시 (참고용 예제 코드)
// - 실제 코드에서는 Balance 페이지나 API 연동 부분에서
//   아래와 비슷한 형태로 호출만 해주면 됩니다.
// - 이 예시는 "개발자 참고"용이므로 사용하지 않으셔도 됩니다.
// =======================================================

/*
  const exampleConfig: WeeklyVideoConfig[] = [
    { weekNumber: 1, videoId: "week1" },
    { weekNumber: 2, videoId: "week2" },
    { weekNumber: 3, videoId: "week3" },
  ];
  
  const exampleEvents: PlayEvent[] = [
    { videoId: "week1", playedAt: "2025-01-01T10:00:00.000Z" },
    { videoId: "week1", playedAt: "2025-01-02T10:00:00.000Z" },
    { videoId: "week1", playedAt: "2025-01-03T10:00:00.000Z" },
  ];
  
  const exampleSub: UserSubscription = {
    userId: "example-user",
    programId: "autobalance",
    subscriptionType: "free_trial",
    startDate: "2025-01-01T00:00:00.000Z",
    currentWeek: 1,
    status: "active",
    pausedAt: null,
    trialEndDate: "2025-01-08T00:00:00.000Z",
  };
  
  const state = calculateBalanceState(
    exampleConfig,
    exampleEvents,
    "2025-01-01T00:00:00.000Z",
    exampleSub
  );
  
  console.log(state);
  */
