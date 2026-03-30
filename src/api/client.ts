// src/api/client.ts
import axios from "axios";
import type {
  ApiListResponse,
  UploadInitResponse,
  Video,
  VideoMetaUpdate,
} from "@/types/video";

// ========================================================================
// Axios instances
// ========================================================================

const adminApi = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const balanceAdminApi = axios.create({
  baseURL: "/api/admin/balance",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const publicApi = axios.create({
  baseURL: "/api/public",
  headers: { "Content-Type": "application/json" },
});

// ========================================================================
// Admin videos
// ========================================================================

export async function listVideos(
  nextToken?: string
): Promise<ApiListResponse<Video>> {
  const { data } = await adminApi.get("/videos", { params: { nextToken } });
  return data;
}

// ========================================================================
// ✅ presign upload (관리자 전용, 단일 경로)
// ========================================================================

export async function initiateUpload(params: {
  fileName: string;
  fileType: string;
  title: string;
  description?: string;
  folder: string;
  videoId: string;
}): Promise<UploadInitResponse> {
  const { data } = await adminApi.post("/presign-upload", params);
  return data;
}

// ========================================================================
// ✅ Introduction complete / meta
// ========================================================================

// multipart complete 에서 사용되는 part 타입
export type MultipartPart = {
  partNumber: number;
  etag: string;
};

// 기존 단일 complete payload + (선택) multipart 필드 확장
export type CompleteUploadPayload = {
  key: string;
  thumbnailKey?: string;
  title: string;
  description?: string;

  // ✅ multipart일 때만 사용
  uploadId?: string;
  parts?: MultipartPart[];
};

export async function completeUpload(
  videoId: string,
  payload: CompleteUploadPayload
): Promise<Video> {
  // ✅ 충돌 방지: payload는 그대로 전달하되,
  // multipart 필드(uploadId/parts)가 있으면 함께 전송된다.
  const { data } = await adminApi.post(`/videos/${videoId}/complete`, payload);
  return data;
}

export async function updateVideo(
  videoId: string,
  patch: VideoMetaUpdate
): Promise<Video> {
  const { data } = await adminApi.patch(`/videos/${videoId}`, patch);
  return data;
}

export async function deleteVideo(videoId: string): Promise<{ ok: true }> {
  const { data } = await adminApi.delete(`/videos/${videoId}`);
  return data;
}

// ========================================================================
// Balance APIs (변경 없음)
// ========================================================================

export type BalanceVideo = Video & {
  program: string;
  weekNumber: number;
  isPublished?: boolean;
};

export async function listBalanceVideos(
  program: string
): Promise<{ items: BalanceVideo[] }> {
  const { data } = await balanceAdminApi.get(`/videos/${program}`);
  return data;
}

export async function completeBalanceUpload(
  program: string,
  weekNumber: number,
  payload: {
    videoId: string;
    key: string;
    title: string;
    description?: string;
    thumbnailKey?: string;
  }
) {
  const { data } = await balanceAdminApi.post(`/complete`, {
    program,
    weekNumber,
    ...payload,
  });
  return data;
}

export async function updateBalanceVideo(
  program: string,
  weekNumber: number,
  patch: {
    title?: string;
    description?: string;
    thumbnailKey?: string;
    isPublished?: boolean;
  }
) {
  const { data } = await balanceAdminApi.patch(
    `/videos/${program}/${weekNumber}`,
    patch
  );
  return data;
}

export async function deleteBalanceVideo(program: string, weekNumber: number) {
  const { data } = await balanceAdminApi.delete(
    `/videos/${program}/${weekNumber}`
  );
  return data;
}

// ========================================================================
// Weekly Habit APIs (관리자)
// ========================================================================

export type HabitItem = {
  name: string;
  description: string;
};

export type WeeklyHabitContent = {
  program: string;
  weekNumber: number;
  videoKey: string | null;
  thumbnailKey: string | null;
  habitTitle: string;
  habitDescription: string;
  habitItems: HabitItem[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

const weeklyHabitAdminApi = axios.create({
  baseURL: "/api/admin/weekly-habit",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export async function listWeeklyHabitContent(
  program: string
): Promise<{ items: WeeklyHabitContent[] }> {
  const { data } = await weeklyHabitAdminApi.get(`/${program}`);
  return data;
}

export async function getWeeklyHabitContent(
  program: string,
  weekNumber: number
): Promise<{ item: WeeklyHabitContent }> {
  const { data } = await weeklyHabitAdminApi.get(`/${program}/${weekNumber}`);
  return data;
}

export async function createWeeklyHabitContent(
  program: string,
  weekNumber: number,
  payload: {
    videoKey?: string;
    thumbnailKey?: string;
    habitTitle: string;
    habitDescription?: string;
    habitItems?: HabitItem[];
  }
) {
  const { data } = await weeklyHabitAdminApi.post(
    `/${program}/${weekNumber}`,
    payload
  );
  return data;
}

export async function updateWeeklyHabitContent(
  program: string,
  weekNumber: number,
  payload: {
    videoKey?: string;
    thumbnailKey?: string;
    habitTitle?: string;
    habitDescription?: string;
    habitItems?: HabitItem[];
  }
) {
  const { data } = await weeklyHabitAdminApi.put(
    `/${program}/${weekNumber}`,
    payload
  );
  return data;
}

export async function deleteWeeklyHabitContent(
  program: string,
  weekNumber: number
) {
  const { data } = await weeklyHabitAdminApi.delete(
    `/${program}/${weekNumber}`
  );
  return data;
}

// ========================================================================
// Sleep Habit APIs (관리자 — 주차별 수면 습관 관리)
// ========================================================================

export type SleepHabitWeek = {
  program: string;
  weekNumber: number;
  habits: string[];
  createdAt?: string;
  updatedAt?: string;
};

const sleepHabitAdminApi = axios.create({
  baseURL: "/api/admin/sleep-habit",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export async function getSleepHabitContent(
  program: string,
  weekNumber: number
): Promise<{ item: SleepHabitWeek }> {
  const { data } = await sleepHabitAdminApi.get(`/${program}/${weekNumber}`);
  return data;
}

export async function saveSleepHabitContent(
  program: string,
  weekNumber: number,
  payload: { habits: string[] }
) {
  const { data } = await sleepHabitAdminApi.put(
    `/${program}/${weekNumber}`,
    payload
  );
  return data;
}

export async function deleteSleepHabitContent(
  program: string,
  weekNumber: number
) {
  const { data } = await sleepHabitAdminApi.delete(
    `/${program}/${weekNumber}`
  );
  return data;
}

// ========================================================================
// Public
// ========================================================================

export async function listPublicVideos(): Promise<ApiListResponse<Video>> {
  const { data } = await publicApi.get("/videos");
  return data;
}
