// components/adminStudio/BalanceVideoDetailModal.tsx
"use client";

import { useMemo, useState } from "react";
import type { BalanceVideo } from "@/api/client";
import { completeBalanceUpload } from "@/api/client";
import { makeThumbnailUrl, makeVideoUrl } from "@/config/constants";
import BalanceThumbnailModal from "@/components/adminStudio/balance-thumbnail-modal";
import "@/components/adminStudio/intro.css";

type UploadedPart = { PartNumber: number; ETag: string };

/**
 * ============================
 * 🔧 용량 조절 포인트
 * ============================
 * Studio.tsx와 동일하게 유지 (64MB)
 */
const CHUNK_SIZE = 64 * 1024 * 1024;

function buildBalanceVideoId(program: string, weekNumber: number, video: any) {
  // ✅ 추측 최소화: 서버가 내려준 값이 있으면 그걸 우선 사용
  // - video.videoId 또는 video.id가 존재하는 경우 그대로 사용
  // - 없으면 업로드 때 사용했던 규칙(program-week-N)로 fallback
  return video?.videoId ?? video?.id ?? `${program}-week-${weekNumber}`;
}

function normalizeEtag(v: string) {
  // ETag가 "xxxx" 로 오는 경우가 있어 따옴표 제거
  return v.replace(/^"+|"+$/g, "");
}

export default function BalanceVideoDetailModal({
  video,
  program,
  onClose,
  onChanged,
}: {
  video: BalanceVideo;
  program: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(video.title ?? "");
  const [description, setDescription] = useState(video.description ?? "");
  const [saving, setSaving] = useState(false);
  const [showThumbModal, setShowThumbModal] = useState(false);

  // ----------------------------
  // 파일 교체 상태
  // ----------------------------
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState(0);

  const weekNumber = video.weekNumber;

  /**
   * ✅ 기존 key에서 folder / fileName 추출
   * - 가능하면 기존 위치/파일명 그대로 사용 (S3 경로 변화 최소화)
   */
  const { folderPath, fileName } = useMemo(() => {
    const key = video.key ?? "";
    const idx = key.lastIndexOf("/");

    // key가 정상적으로 있으면 그대로 재사용
    if (idx > 0) {
      return {
        folderPath: key.slice(0, idx),
        fileName: key.slice(idx + 1),
      };
    }

    // fallback: Studio.tsx 규칙과 동일한 기본 경로/파일명
    const S3_BALANCE_ROOT = "weekly-solutions";
    return {
      folderPath: `videos/${S3_BALANCE_ROOT}/${program}/week-${weekNumber}`,
      fileName: `${program}-week-${weekNumber}.mp4`,
    };
  }, [video.key, program, weekNumber]);

  /* ================= multipart APIs (Balance 전용) ================= */
  async function mpInitiate(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${weekNumber}/multipart/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || "initiate 응답 파싱 실패");
    }
  }

  async function mpSignPart(payload: any) {
    const res = await fetch(`/api/admin/balance/videos/${program}/${weekNumber}/multipart/part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || "part 응답 파싱 실패");
    }
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

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || "complete 응답 파싱 실패");
    }
  }

  // ----------------------------
  // 제목/설명 저장 (기존 로직 유지)
  // ----------------------------
  async function save() {
    setSaving(true);
    try {
      const videoId = buildBalanceVideoId(program, video.weekNumber, video);

      // ✅ 핵심: upstream에 존재하는 /complete 엔드포인트를 재사용(업서트)
      // - key/thumbnailKey는 기존 값을 그대로 유지
      // - title/description만 변경
      await completeBalanceUpload(program, video.weekNumber, {
        videoId,
        key: video.key,
        title,
        description,
        thumbnailKey: video.thumbnailKey,
      });

      alert("저장되었습니다.");
      await onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function onSelectReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    setReplaceFile(e.target.files?.[0] ?? null);
    setProgress(0);
  }

  // ----------------------------
  // ✅ 동영상 파일 교체 (Balance multipart 업로드)
  // ----------------------------
  async function handleReplaceVideo() {
    if (!replaceFile) {
      alert("파일을 선택해주세요.");
      return;
    }

    setReplacing(true);
    setProgress(0);

    try {
      const videoId = buildBalanceVideoId(program, weekNumber, video);

      // 1) initiate
      const init = await mpInitiate({
        fileName, // ✅ 기존 파일명 유지 (가능하면 동일 key로 업로드)
        fileType: replaceFile.type || "video/mp4",
        folder: folderPath, // ✅ 기존 폴더 유지
        videoId,
      });

      if (!init?.uploadId || !init?.key) {
        throw new Error("initiate 응답에 uploadId/key가 없습니다.");
      }

      const totalParts = Math.ceil(replaceFile.size / CHUNK_SIZE);
      const parts: UploadedPart[] = [];

      // 2) part 업로드
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, replaceFile.size);
        const chunk = replaceFile.slice(start, end);

        const partRes = await mpSignPart({
          key: init.key,
          uploadId: init.uploadId,
          partNumber,
        });

        const uploadUrl = partRes?.uploadUrl ?? partRes?.url ?? partRes?.presignedUrl;

        if (!uploadUrl) {
          throw new Error(`part ${partNumber}: uploadUrl이 없습니다.`);
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: chunk,
          // Content-Type을 강제하지 않아도 되지만, 명시해도 안전
          headers: { "Content-Type": init.contentType ?? replaceFile.type },
        });

        if (!putRes.ok) {
          throw new Error(`part ${partNumber}: 업로드 실패 (${putRes.status})`);
        }

        const rawEtag = putRes.headers.get("etag");
        if (!rawEtag) {
          throw new Error(`part ${partNumber}: ETag가 없습니다.`);
        }

        parts.push({
          PartNumber: partNumber,
          ETag: normalizeEtag(rawEtag),
        });

        setProgress(Math.round((partNumber / totalParts) * 100));
      }

      // 3) complete
      const done = await mpComplete({
        key: init.key,
        uploadId: init.uploadId,
        parts,
      });

      const newKey = done?.key ?? init.key;

      // 4) DB 업서트(/complete 재사용): key만 새 것으로 교체 + 제목/설명은 현재 입력값 사용
      await completeBalanceUpload(program, weekNumber, {
        videoId,
        key: newKey,
        title,
        description,
        thumbnailKey: video.thumbnailKey,
      });

      alert("동영상이 교체되었습니다.");
      await onChanged();
      onClose();
    } catch (e) {
      console.error(e);
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
        <button className="intro-close" onClick={onClose} type="button">
          ✕
        </button>

        <h2 className="intro-modal-title">주차 영상 상세 정보</h2>

        <div className="text-sm text-slate-600">
          프로그램: <b>{program}</b> / 주차: <b>{video.weekNumber}</b>
        </div>

        {/* 제목 */}
        <label className="intro-label">제목</label>
        <input
          className="intro-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving || replacing}
        />

        {/* 설명 */}
        <label className="intro-label">설명</label>
        <textarea
          className="intro-textarea"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving || replacing}
        />

        {/* 썸네일 */}
        <label className="intro-label">썸네일</label>
        {video.thumbnailKey ? (
          <img
            src={makeThumbnailUrl(video.thumbnailKey)}
            alt="thumbnail"
            className="intro-thumbnail-preview"
          />
        ) : (
          <div className="w-[180px] h-[100px] border border-dashed rounded flex items-center justify-center text-xs text-slate-400 mt-2">
            썸네일 없음
          </div>
        )}

        <button
          className="intro-upload-btn"
          onClick={() => setShowThumbModal(true)}
          type="button"
          disabled={saving || replacing}
        >
          썸네일 변경
        </button>

        {/* 동영상 */}
        <label className="intro-label">영상 미리보기</label>
        <video
          src={makeVideoUrl(video.key)}
          controls
          controlsList="nodownload"
          className="rounded-md border bg-black mt-2 w-full max-w-[640px]"
        />

        {/* ✅ 동영상 교체 */}
        <div className="mt-6">
          <label className="intro-label">동영상 교체</label>

          <input
            type="file"
            accept="video/*"
            onChange={onSelectReplaceFile}
            disabled={saving || replacing}
          />

          <button
            className="intro-upload-btn mt-3"
            onClick={handleReplaceVideo}
            disabled={!replaceFile || replacing || saving}
            type="button"
          >
            {replacing ? "업로드 중..." : "동영상 교체"}
          </button>

          {replacing && <p className="intro-progress">진행률: {progress}%</p>}

          <p className="text-xs text-slate-500 mt-2">
            * 동영상 교체는 영상 파일만 변경합니다. 제목/설명 변경은 아래 “저장” 버튼을 이용하세요.
          </p>
        </div>

        {/* 저장 */}
        <button
          className="intro-upload-btn mt-6"
          disabled={saving || replacing}
          onClick={save}
          type="button"
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {showThumbModal && (
          <BalanceThumbnailModal
            program={program}
            weekNumber={video.weekNumber}
            video={video}
            onClose={() => setShowThumbModal(false)}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
}
