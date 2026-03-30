"use client";

import { useEffect, useState } from "react";
import { listVideos } from "@/api/client";
import type { Video } from "@/types/video";
import { makeVideoUrl } from "@/config/constants";
import "./intro.css";

export default function IntroVideoList({
  onSelect,
}: {
  onSelect: (video: Video) => void;
}) {
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { items } = await listVideos();
    const intro = items.find((v) => v.id === "featured");
    if (intro) setVideo(intro);
  }

  return (
    <div className="mt-10">

      {/* ❌ 업로드 박스 완전히 제거됨 */}

      <h2 className="text-xl font-bold mb-3">목록</h2>

      {!video && (
        <p className="text-slate-500 text-sm">
          업로드된 Introduction 영상이 없습니다.
        </p>
      )}

      {video && (
        <table className="w-full border-collapse intro-table-fixed text-sm">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="p-3 w-[280px] text-left">동영상</th>
              <th className="p-3 w-[300px] text-left">제목</th>
              <th className="p-3 w-[160px] text-left">업로드 날짜</th>
              <th className="p-3 w-[120px] text-left">조회수</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b hover:bg-slate-50 transition">
              {/* A2 — 작은 동영상 미리보기 */}
              <td className="p-3">
                <div className="flex items-center gap-3">

                  <div className="video-thumb-wrapper">
                    <video
                      src={makeVideoUrl(video.key)}
                      className="video-thumb"
                      muted
                    />
                  </div>

                  {/* 수정 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(video);
                    }}
                    className="text-lg hover:opacity-70"
                  >
                    ✏️
                  </button>
                </div>
              </td>

              {/* 제목 */}
              <td className="p-3 font-medium">{video.title}</td>

              {/* 업로드 날짜 */}
              <td className="p-3 text-slate-600">
                {video.createdAt?.slice(0, 10)}
              </td>

              {/* 조회수 */}
              <td className="p-3 text-slate-600">0회</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
