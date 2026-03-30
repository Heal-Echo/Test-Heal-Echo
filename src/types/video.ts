// src/types/video.ts
// =======================================================
// 영상 관련 공유 타입 정의
// =======================================================

// ─── 관리자 API 공통 타입 ───

/** API 목록 응답 (페이지네이션 포함) */
export type ApiListResponse<T> = {
  items: T[];
  nextToken?: string;
};

/** 영상 기본 타입 (DynamoDB IntroVideosTable 레코드 기준) */
export type Video = {
  id: string;
  title: string;
  key: string;              // S3 Key (예: "videos/featured/Introduction.mp4")
  thumbnailKey?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
};

/** presign-upload 응답 */
export type UploadInitResponse = {
  uploadUrl: string;         // 단일 파일 업로드용 presigned URL
  uploadId: string;          // multipart 업로드 ID
  key: string;               // S3 Key
  contentType: string;       // 업로드 파일의 MIME 타입
};

/** 영상 메타 수정 패치 */
export type VideoMetaUpdate = {
  title?: string;
  description?: string;
  thumbnailKey?: string | null;
};

// ─── Player 전용 타입 ───

/**
 * Player에서 사용할 최소 단위 영상 데이터
 * - 공개 API 응답 기준으로 key/title/thumbnailKey를 중심으로 사용
 */
export type PlayerVideo = {
  id: string;              // API의 id (예: "featured", "autobalance-week-1")
  title: string;
  key: string;             // S3 Key (예: "videos/featured/Introduction.mp4")
  thumbnailKey?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
};

/**
 * API 응답이 아래 중 어떤 형태든 대응:
 * - 배열: [{...}, {...}]
 * - 객체: { items: [...] }
 */
function getItems(apiResponse: any): any[] {
  if (!apiResponse) return [];
  if (Array.isArray(apiResponse)) return apiResponse;
  if (Array.isArray(apiResponse.items)) return apiResponse.items;
  return [];
}

/**
 * raw 데이터를 PlayerVideo 형태로 정규화
 * - id가 없으면 videoId를 id로 대체(호환)
 */
export function normalizeToPlayerVideo(raw: any): PlayerVideo | null {
  if (!raw) return null;

  const id = raw?.id ?? raw?.videoId;
  const key = raw?.key;

  if (!id || !key) return null;

  return {
    id: String(id),
    title: raw?.title ? String(raw.title) : "웰니스 영상",
    key: String(key),
    thumbnailKey: raw?.thumbnailKey ? String(raw.thumbnailKey) : undefined,
    description: raw?.description ? String(raw.description) : undefined,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
    userId: raw?.userId ? String(raw.userId) : undefined,
  };
}

/**
 * public/videos API 응답에서 특정 ID(또는 videoId)에 해당하는 영상을 찾아 반환
 * - id 우선 매칭
 * - videoId 필드가 존재하는 경우도 대비
 */
export function extractPlayerVideoById(
  apiResponse: any,
  targetId: string
): PlayerVideo | null {
  if (!apiResponse || !targetId) return null;

  const items = getItems(apiResponse);

  const found = items.find((v: any) => {
    const id = v?.id ?? v?.videoId;
    return String(id) === String(targetId);
  });

  return normalizeToPlayerVideo(found);
}
