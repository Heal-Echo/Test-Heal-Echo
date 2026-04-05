// src/app/wellness/balance/player/playerBrain.ts
// =======================================================
// Heal Echo Balance - Player 전용 Brain
// - Balance 공개 목록 API 응답에서 weekNumber로 영상 찾기
// - 응답 형태: { items: [...] } 또는 배열 모두 대응
// =======================================================

export type BalanceListItem = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PlayerVideo = {
  program: string;
  weekNumber: number;
  videoId: string;
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;
};

function getItems(apiResponse: any): any[] {
  if (!apiResponse) return [];
  if (Array.isArray(apiResponse)) return apiResponse;
  if (Array.isArray(apiResponse.items)) return apiResponse.items;
  return [];
}

function normalize(raw: any): PlayerVideo | null {
  if (!raw) return null;

  // 필수 키들
  if (!raw.program || raw.weekNumber === undefined || !raw.videoId || !raw.key) {
    return null;
  }

  return {
    program: String(raw.program),
    weekNumber: Number(raw.weekNumber),
    videoId: String(raw.videoId),
    key: String(raw.key),
    thumbnailKey: raw.thumbnailKey ? String(raw.thumbnailKey) : undefined,
    title: raw.title ? String(raw.title) : "웰니스 영상",
    description: raw.description ? String(raw.description) : undefined,
  };
}

/**
 * 프로그램 목록 응답에서 주차(weekNumber)로 영상 1개 추출
 */
export function extractPlayerVideoByWeek(apiResponse: any, weekNumber: number): PlayerVideo | null {
  const items = getItems(apiResponse);

  const found = items.find((v: any) => Number(v?.weekNumber) === Number(weekNumber));
  return normalize(found);
}
