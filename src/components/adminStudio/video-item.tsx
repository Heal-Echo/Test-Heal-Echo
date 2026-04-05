"use client";

import { useState } from "react";
import { updateVideo, deleteVideo } from "@/api/client";
import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";
import type { Video } from "@/types/video";
import ThumbnailModal from "./thumbnail-modal";

export default function VideoItem({ video, onChanged }: { video: Video; onChanged: () => void }) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showThumbModal, setShowThumbModal] = useState(false);

  const hasThumbnail = !!video.thumbnailKey;

  async function saveMeta() {
    setSaving(true);
    try {
      await updateVideo(video.id, { title, description });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteVideo(video.id);
      onChanged();
    } finally {
      setDeleting(false);
    }
  }

  async function removeThumbnail() {
    if (!confirm("썸네일을 삭제하시겠습니까?")) return;
    await updateVideo(video.id, { thumbnailKey: null });
    onChanged();
  }

  return (
    <li className="border rounded p-4 bg-white space-y-6">
      {/* 제목 */}
      <div>
        <label className="text-sm text-gray-600">제목</label>
        <input
          className="block border p-2 w-full text-sm rounded mt-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="text-sm text-gray-600">설명</label>
        <textarea
          className="block border p-2 w-full text-sm rounded mt-1"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* 영상 미리보기 */}
      <div>
        <label className="text-sm font-semibold">영상 미리보기</label>
        <video
          src={makeVideoUrl(video.key)}
          controls
          className="rounded-md border bg-black mt-2 w-full max-w-[640px] mx-auto"
        />
      </div>

      {/* 썸네일 */}
      <div>
        <label className="text-sm font-semibold">썸네일</label>
        <div className="mt-2 flex flex-col gap-2">
          {hasThumbnail ? (
            <img
              src={makeThumbnailUrl(video.thumbnailKey!)}
              alt="thumbnail"
              className="w-40 border rounded"
            />
          ) : (
            <p className="text-sm text-gray-500">등록된 썸네일 없음</p>
          )}

          <div className="flex gap-2">
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
              onClick={() => setShowThumbModal(true)}
            >
              썸네일 변경
            </button>

            {hasThumbnail && (
              <button
                className="px-3 py-2 bg-red-600 text-white rounded text-sm"
                onClick={removeThumbnail}
              >
                썸네일 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 저장/삭제 */}
      <div className="flex gap-2 pt-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
          disabled={saving}
          onClick={saveMeta}
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        <button
          className="px-4 py-2 bg-red-600 text-white rounded text-sm"
          disabled={deleting}
          onClick={remove}
        >
          {deleting ? "삭제 중..." : "삭제"}
        </button>
      </div>

      {showThumbModal && (
        <ThumbnailModal
          video={video}
          onClose={() => setShowThumbModal(false)}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}
