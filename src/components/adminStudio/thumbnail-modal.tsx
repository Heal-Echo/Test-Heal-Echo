// src/components/adminStudio/ThumbnailModal.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import { initiateUpload, updateVideo } from "@/api/client";
import { makeThumbnailUrl } from "@/config/constants";
import type { Video } from "@/types/video";

export default function ThumbnailModal({
  video,
  onClose,
  onChanged,
}: {
  video: Video;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setPreview(URL.createObjectURL(selected));
    }
  }

  async function uploadThumbnail() {
    if (!file) {
      alert("썸네일 파일을 선택하세요.");
      return;
    }

    setBusy(true);

    try {
      /**
       * 🔥 핵심: 썸네일은 항상 같은 규칙으로 저장
       *
       * thumbnails/<videoId>/<파일명>
       *
       * - userId 에 의존하지 않아서 로그인/업로드 로직과 충돌하지 않음
       * - CloudFront 에서는 thumbnailKey 를 그대로 path 로 사용
       * - DynamoDB thumbnailKey = S3 key = CloudFront path 가 1:1 로 일치
       */
      const folder = `thumbnails/${video.id}`;

      // 1) presign URL 받기
      const init = await initiateUpload({
        fileName: file.name,
        fileType: file.type,
        title: video.title,
        description: video.description ?? "",
        folder,
        videoId: video.id,
      });

      // 2) S3 에 실제 업로드
      await axios.put(init.uploadUrl, file, {
        headers: { "Content-Type": init.contentType },
      });

      // 3) DynamoDB 에 thumbnailKey 갱신
      await updateVideo(video.id, {
        thumbnailKey: init.key, // presign 때 받은 key 그대로 저장
      });

      alert("썸네일이 변경되었습니다.");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      alert("썸네일 업로드 실패 (S3 또는 DB)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-bold">썸네일 변경</h2>

        {/* 현재 썸네일 */}
        <div className="space-y-1">
          <p className="text-sm font-semibold">현재 썸네일</p>
          {video.thumbnailKey ? (
            <img
              src={makeThumbnailUrl(video.thumbnailKey)}
              className="w-48 border rounded"
              alt="current thumbnail"
            />
          ) : (
            <p className="text-sm text-gray-500">등록된 썸네일 없음</p>
          )}
        </div>

        {/* 새 파일 선택 */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">새 썸네일 선택</p>
          <input type="file" accept="image/*" onChange={onFileSelect} />

          {preview && <img src={preview} className="w-48 border rounded" alt="preview" />}
        </div>

        {/* 버튼들 */}
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-4 py-2 bg-gray-500 text-white rounded" onClick={onClose}>
            취소
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={busy || !file}
            onClick={uploadThumbnail}
          >
            {busy ? "업로드 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
