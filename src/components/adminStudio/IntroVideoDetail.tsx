"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import type { Video } from "@/types/video";
import { updateVideo, initiateUpload, completeUpload } from "@/api/client";
import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";
import ThumbnailModal from "./ThumbnailModal";
import "./intro.css";

/**
 * ============================
 * 🔧 용량 조절 포인트 (10GB 테스트용)
 * ============================
 * 50MB 권장 (10GB ≈ 200 parts)
 */
const PART_SIZE = 50 * 1024 * 1024; // 50MB

export default function IntroVideoDetail({
  video,
  onClose,
  onChanged,
}: {
  video: Video;
  onClose: () => void;
  onChanged: () => void;
}) {
  // ----------------------------
  // 메타(제목/설명) 수정 상태 — 유지
  // ----------------------------
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description ?? "");
  const [showThumbModal, setShowThumbModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ----------------------------
  // 파일 교체 상태
  // ----------------------------
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState(0);

  const thumbnail = video.thumbnailKey
    ? makeThumbnailUrl(video.thumbnailKey)
    : null;

  // 기존 로직 유지: key에서 folder 추출
  const videoFolder = useMemo(() => {
    const key = video.key ?? "";
    const idx = key.lastIndexOf("/");
    return idx > 0 ? key.slice(0, idx) : "videos";
  }, [video.key]);

  // ----------------------------
  // 메타 저장 — 유지
  // ----------------------------
  async function saveMeta() {
    setSaving(true);
    try {
      await updateVideo(video.id, { title, description });
      alert("저장되었습니다.");
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    setReplaceFile(e.target.files?.[0] ?? null);
    setProgress(0);
  }

  function normalizeEtag(v: string) {
    return v.replace(/^"+|"+$/g, "");
  }

  // ----------------------------
  // 🔧 동영상 교체 (멀티파트 업로드) — 여기만 변경
  // ----------------------------
  async function handleReplaceVideo() {
    if (!replaceFile) {
      alert("파일을 선택해주세요.");
      return;
    }

    setReplacing(true);
    setProgress(0);

    try {
      // 1️⃣ initiate (기존 로직 유지)
      const init = await initiateUpload({
        fileName: replaceFile.name,
        fileType: replaceFile.type,
        title: video.title,
        description: video.description ?? "",
        folder: videoFolder,
        videoId: video.id,
      });

      const totalParts = Math.ceil(replaceFile.size / PART_SIZE);
      const parts: { partNumber: number; etag: string }[] = [];

      // 2️⃣ 파일을 PART_SIZE 단위로 분할 업로드
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, replaceFile.size);
        const blob = replaceFile.slice(start, end);

        // presign for this part
        const partRes = await axios.post("/api/admin/multipart/part", {
          uploadId: init.uploadId,
          key: init.key,
          partNumber,
          contentType: init.contentType,
        });

        const uploadUrl =
          partRes.data?.uploadUrl ??
          partRes.data?.url ??
          partRes.data?.presignedUrl;

        if (!uploadUrl) {
          throw new Error(`part ${partNumber}: uploadUrl 없음`);
        }

        // PUT chunk
        const putRes = await axios.put(uploadUrl, blob, {
          headers: { "Content-Type": init.contentType },
        });

        const rawEtag = putRes.headers?.etag;
        if (!rawEtag) {
          throw new Error(`part ${partNumber}: ETag 없음`);
        }

        parts.push({
          partNumber,
          etag: normalizeEtag(rawEtag),
        });

        // 진행률 업데이트
        setProgress(Math.round((partNumber / totalParts) * 100));
      }

      // 3️⃣ complete (기존 구조 유지)
      await completeUpload(video.id, {
        videoId: video.id as any,
        key: init.key,
        title: video.title,
        description: video.description ?? "",
        thumbnailKey: video.thumbnailKey ?? undefined,
        uploadId: init.uploadId,
        parts,
      } as any);

      alert("동영상이 교체되었습니다.");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      alert("동영상 교체에 실패했습니다.");
    } finally {
      setReplacing(false);
      setReplaceFile(null);
      setProgress(0);
    }
  }

  return (
    <div className="intro-modal-overlay">
      <div className="intro-modal">
        <button className="intro-close" onClick={onClose}>
          ✕
        </button>

        <h2 className="intro-modal-title">영상 상세 정보</h2>

        {/* ----------------------------
            메타 수정 UI — 유지
           ---------------------------- */}
        <label className="intro-label">제목</label>
        <input
          className="intro-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={replacing}
        />

        <label className="intro-label">설명</label>
        <textarea
          className="intro-textarea"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={replacing}
        />

        {/* 썸네일 — 유지 */}
        <label className="intro-label">썸네일</label>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="thumbnail"
            className="intro-thumbnail-preview"
          />
        ) : (
          <div className="w-[180px] h-[100px] border border-dashed rounded flex items-center justify-center text-xs text-slate-400">
            썸네일 없음
          </div>
        )}

        <button
          className="intro-upload-btn"
          onClick={() => setShowThumbModal(true)}
          disabled={replacing}
        >
          썸네일 변경
        </button>

        {/* 영상 미리보기 — 유지 */}
        <label className="intro-label">영상 미리보기</label>
        <video
          src={makeVideoUrl(video.key)}
          controls
          controlsList="nodownload"
          className="rounded-md border bg-black mt-2 w-full max-w-[640px]"
        />

        {/* ----------------------------
            동영상 교체 — 용량 대응만 변경
           ---------------------------- */}
        <div className="mt-6">
          <label className="intro-label">동영상 교체</label>

          <input
            type="file"
            accept="video/*"
            onChange={onSelectFile}
            disabled={saving || replacing}
          />

          <button
            className="intro-upload-btn mt-3"
            onClick={handleReplaceVideo}
            disabled={!replaceFile || replacing}
          >
            {replacing ? "업로드 중..." : "동영상 교체"}
          </button>

          {replacing && (
            <p className="intro-progress">진행률: {progress}%</p>
          )}

          {/* 🔒 문구 유지 */}
          <p className="text-xs text-slate-500 mt-2">
            * 동영상 교체는 영상 파일만 변경합니다. 제목/설명 변경은 아래 “저장”
            버튼을 이용하세요.
          </p>
        </div>

        {/* ----------------------------
            메타 저장 — 유지
           ---------------------------- */}
        <button
          className="intro-upload-btn mt-6"
          disabled={saving || replacing}
          onClick={saveMeta}
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {showThumbModal && (
          <ThumbnailModal
            video={video}
            onClose={() => setShowThumbModal(false)}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
}
