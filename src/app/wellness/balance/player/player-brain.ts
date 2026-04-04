// src/app/wellness/balance/player/player-brain.ts
// =======================================================
// Heal Echo Balance - Player 전용 Brain
// - Balance 공개 목록 API 응답에서 weekNumber로 영상 찾기
// - 응답 형태: { items: [...] } 또는 배열 모두 대응
// =======================================================

import type { BalanceListItem, BalanceVideo } from "@/types/balance";

function getItems(apiResponse: unknown): unknown[] {
  if (!apiResponse) return [];
  if (Array.isArray(apiResponse)) return apiResponse;
  if (
    typeof apiResponse === "object" &&
    apiResponse !== null &&
    "items" in apiResponse
  ) {
    const obj = apiResponse as { items?: unknown };
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

function normalize(raw: unknown): BalanceVideo | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  if (
    !item.program ||
    item.weekNumber === undefined ||
    !item.videoId ||
    !item.key
  ) {
    return null;
  }

  return {
    program: String(item.program),
    weekNumber: Number(item.weekNumber),
    videoId: String(item.videoId),
    key: String(item.key),
    thumbnailKey: item.thumbnailKey ? String(item.thumbnailKey) : undefined,
    title: item.title ? String(item.title) : "웰니스 영상",
    description: item.description ? String(item.description) : undefined,
  };
}

/**
 * 프로그램 목록 응답에서 주차(weekNumber)로 영상 1개 추출
 */
export function extractBalanceVideoByWeek(
  apiResponse: unknown,
  weekNumber: number
): BalanceVideo | null {
  const items = getItems(apiResponse);

  const found = items.find(
    (v) =>
      v !== null &&
      typeof v === "object" &&
      Number((v as Record<string, unknown>).weekNumber) === Number(weekNumber)
  );
  return normalize(found);
}
