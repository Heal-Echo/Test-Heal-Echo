"use client";

import { useState } from "react";
import type { BalanceVideo } from "@/api/client";
import { completeBalanceUpload } from "@/api/client";
import { makeThumbnailUrl } from "@/config/constants";

type UploadedPart = { PartNumber: number; ETag: string };

function buildBalanceVideoId(program: string, weekNumber: number, video: any) {
  return video?.videoId ?? video?.id ?? `${program}-week-${weekNumber}`;
}

export default function BalanceThumbnailModal({
  program,
  weekNumber,
  video,
  onClose,
  onChanged,
}: {
  program: string;
  weekNumber: number;
  video: BalanceVideo;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) setPreview(URL.createObjectURL(selected));
  }

  // Studio.tsx와 동일한 multipart 엔드포인트를 사용 (Balance 전용)
  async function mpInitiate(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${weekNumber}/multipart/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return res.json();
  }

  async function mpSignPart(payload: any) {
    const res = await fetch(`/api/admin/balance/videos/${program}/${weekNumber}/multipart/part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function mpComplete(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${weekNumber}/multipart/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return res.json();
  }

  async function uploadAndApply() {
    if (!file) {
      alert("썸네일 파일을 선택하세요.");
      return;
    }

    setBusy(true);
    try {
      // ✅ Weekly Solution(Balance) 전용 썸네일 규칙(Introduction과 분리)
      const S3_BALANCE_ROOT = "weekly-solutions";
      const safeExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${program}-week-${weekNumber}.${safeExt}`;
      const folderPath = `thumbnails/${S3_BALANCE_ROOT}/${program}/week-${weekNumber}`;
      const videoId = buildBalanceVideoId(program, weekNumber, video);

      // 1) initiate
      const init = await mpInitiate({
        fileName,
        fileType: file.type || "image/jpeg",
        folder: folderPath,
        videoId,
      });

      // 2) presign (part 1)
      const { uploadUrl } = await mpSignPart({
        key: init.key,
        uploadId: init.uploadId,
        partNumber: 1,
      });

      // 3) upload PUT
      const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
      const etag = putRes.headers.get("etag")!;
      const parts: UploadedPart[] = [{ PartNumber: 1, ETag: etag }];

      // 4) complete multipart
      const done = await mpComplete({
        key: init.key,
        uploadId: init.uploadId,
        parts,
      });

      // ✅ 핵심: upstream에 “수정 엔드포인트”가 없으므로 /complete로 업서트
      await completeBalanceUpload(program, weekNumber, {
        videoId,
        key: video.key, // 기존 영상 key 유지
        title: video.title, // 기존 title 유지 (모달에서 따로 저장)
        description: video.description ?? "",
        thumbnailKey: done.key, // 새 thumbnailKey만 반영
      });

      alert("썸네일이 변경되었습니다.");
      await onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      alert("썸네일 업로드/저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-bold">썸네일 변경 (Weekly Solution)</h2>

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
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded"
            onClick={onClose}
            type="button"
          >
            취소
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={busy || !file}
            onClick={uploadAndApply}
            type="button"
          >
            {busy ? "업로드 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
