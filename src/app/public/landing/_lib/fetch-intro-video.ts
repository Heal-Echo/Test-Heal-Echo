import { FEATURED_VIDEO_ID, PUBLIC_INTRO_VIDEOS_URL, API_URL } from "@/config/constants";

function resolveUpstreamUrl(): string | null {
  if (PUBLIC_INTRO_VIDEOS_URL.trim().length > 0) {
    return PUBLIC_INTRO_VIDEOS_URL.trim();
  }

  if (!API_URL) return null;

  return `${API_URL.replace(/\/$/, "")}/public/videos`;
}

type VideoItem = {
  id: string;
  key: string;
  thumbnailKey?: string | null;
};

export type IntroVideoData = {
  videoKey: string | null;
  thumbnailKey: string | null;
  error: string | null;
};

export async function fetchIntroVideo(): Promise<IntroVideoData> {
  try {
    const url = resolveUpstreamUrl();
    if (!url) {
      console.error("[Landing] Upstream URL not configured.");
      return { videoKey: null, thumbnailKey: null, error: "소개 영상을 불러올 수 없습니다." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 3600 }, // 1시간 ISR 캐싱
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[Landing] Upstream returned:", res.status);
      return {
        videoKey: null,
        thumbnailKey: null,
        error: "소개 영상을 불러오는 중 문제가 발생했습니다.",
      };
    }

    let data: { items?: VideoItem[] };
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error(
        "[Landing] JSON parse failed:",
        parseErr instanceof Error ? parseErr.message : "Unknown"
      );
      return {
        videoKey: null,
        thumbnailKey: null,
        error: "소개 영상 데이터를 처리하는 중 문제가 발생했습니다.",
      };
    }
    const items: VideoItem[] = Array.isArray(data.items) ? data.items : [];
    const match = items.find((v) => v.id === FEATURED_VIDEO_ID);

    if (!match) {
      return { videoKey: null, thumbnailKey: null, error: null };
    }

    return {
      videoKey: match.key,
      thumbnailKey: match.thumbnailKey ?? null,
      error: null,
    };
  } catch (err) {
    console.error(
      "[Landing] Failed to fetch intro video:",
      err instanceof Error ? err.message : "Unknown error"
    );
    return {
      videoKey: null,
      thumbnailKey: null,
      error: "소개 영상을 불러오는 중 문제가 발생했습니다.",
    };
  }
}
