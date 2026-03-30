// components/adminStudio/Studio.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  listBalanceVideos,
  completeBalanceUpload,
  deleteBalanceVideo,
  type BalanceVideo,
} from "@/api/client";
import { makeThumbnailUrl, makeVideoUrl } from "@/config/constants";
import "@/components/adminStudio/intro.css";
import BalanceVideoDetailModal from "@/components/adminStudio/BalanceVideoDetailModal";

type UploadedPart = { PartNumber: number; ETag: string };

export default function Studio({ folder }: { folder: string }) {
  const program = useMemo(() => folder.split("/").pop()!, [folder]);
  const S3_BALANCE_ROOT = "weekly-solutions";

  const [week, setWeek] = useState(1);
  const [videos, setVideos] = useState<BalanceVideo[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [busy, setBusy] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // ✅ 수정 모달용
  const [selected, setSelected] = useState<BalanceVideo | null>(null);

  async function refresh() {
    const { items } = await listBalanceVideos(program);
    setVideos(items);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  /* ================= multipart APIs ================= */
  async function mpInitiate(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${week}/multipart/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return res.json();
  }

  async function mpSignPart(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${week}/multipart/part`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return res.json();
  }

  async function mpComplete(payload: any) {
    const res = await fetch(
      `/api/admin/balance/videos/${program}/${week}/multipart/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return res.json();
  }

  /* ================= upload ================= */
  const CHUNK_SIZE = 64 * 1024 * 1024;

  async function uploadVideoMultipart(): Promise<string> {
    if (!videoFile) throw new Error("video missing");

    setVideoProgress(0);

    const videoId = `${program}-week-${week}`;
    const folderPath = `videos/${S3_BALANCE_ROOT}/${program}/week-${week}`;
    const fileName = `${program}-week-${week}.mp4`;

    const init = await mpInitiate({
      fileName,
      fileType: videoFile.type || "video/mp4",
      folder: folderPath,
      videoId,
    });

    const totalParts = Math.ceil(videoFile.size / CHUNK_SIZE);
    const uploaded: UploadedPart[] = [];

    for (let part = 1; part <= totalParts; part++) {
      const start = (part - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoFile.size);
      const chunk = videoFile.slice(start, end);

      const { uploadUrl } = await mpSignPart({
        key: init.key,
        uploadId: init.uploadId,
        partNumber: part,
      });

      const res = await fetch(uploadUrl, { method: "PUT", body: chunk });
      const etag = res.headers.get("etag")!;
      uploaded.push({ PartNumber: part, ETag: etag });
      setVideoProgress(Math.round((part / totalParts) * 100));
    }

    const done = await mpComplete({
      key: init.key,
      uploadId: init.uploadId,
      parts: uploaded,
    });

    return done.key;
  }

  async function uploadThumbnailSinglePut(): Promise<string | undefined> {
    if (!thumbnailFile) return;

    setThumbProgress(0);

    const videoId = `${program}-week-${week}`;
    const folderPath = `thumbnails/${S3_BALANCE_ROOT}/${program}/week-${week}`;
    const fileName = `${program}-week-${week}.jpg`;

    const init = await mpInitiate({
      fileName,
      fileType: thumbnailFile.type || "image/jpeg",
      folder: folderPath,
      videoId,
    });

    const { uploadUrl } = await mpSignPart({
      key: init.key,
      uploadId: init.uploadId,
      partNumber: 1,
    });

    const res = await fetch(uploadUrl, { method: "PUT", body: thumbnailFile });
    const etag = res.headers.get("etag")!;

    const done = await mpComplete({
      key: init.key,
      uploadId: init.uploadId,
      parts: [{ PartNumber: 1, ETag: etag }],
    });

    setThumbProgress(100);
    return done.key;
  }

  async function handleUploadAll() {
    if (!videoFile) {
      alert("업로드할 영상을 선택해주세요.");
      return;
    }

    try {
      setBusy(true);

      const videoKey = await uploadVideoMultipart();
      const thumbnailKey = await uploadThumbnailSinglePut();

      await completeBalanceUpload(program, week, {
        videoId: `${program}-week-${week}`,
        key: videoKey,
        title,
        description,
        thumbnailKey,
      });

      alert("✅ 업로드 완료");
      resetForm();
      await refresh();
    } catch (e) {
      console.error(e);
      alert("업로드 중 오류 발생");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(targetWeek: number) {
    if (!confirm(`${targetWeek}주차 콘텐츠를 삭제하시겠습니까?`)) return;
    try {
      await deleteBalanceVideo(program, targetWeek);
      alert("삭제 완료");
      await refresh();
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류 발생");
    }
  }

  function resetForm() {
    setShowPopup(false);
    setVideoFile(null);
    setThumbnailFile(null);
    setTitle("");
    setDescription("");
    setVideoProgress(0);
    setThumbProgress(0);
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-10">
      {/* 중앙 업로드 */}
      <div className="intro-container">
        <div
          className="intro-upload-box"
          onClick={() => {
            resetForm();
            setShowPopup(true);
          }}
        >
          <span className="intro-plus">+</span>
        </div>
      </div>

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="intro-file-input"
        onChange={(e) => {
          setVideoFile(e.target.files?.[0] ?? null);
        }}
      />

      {showPopup && (
        <div className="intro-modal-overlay">
          <div className="intro-modal" style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
            <button
              className="intro-close"
              onClick={resetForm}
            >
              ✕
            </button>

            <div className="intro-modal-title">세부 정보</div>

            <label className="intro-label">주차 선택</label>
            <select
              className="intro-input"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
            >
              {Array.from({ length: 52 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}주차
                </option>
              ))}
            </select>

            <label className="intro-label">제목</label>
            <input
              className="intro-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="intro-label">설명</label>
            <textarea
              className="intro-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* 영상 업로드 */}
            <label className="intro-label">영상 선택</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="intro-upload-btn"
                style={{ width: "auto" }}
                onClick={() => videoInputRef.current?.click()}
                type="button"
              >
                영상 선택
              </button>
              <span style={{ fontSize: 13 }}>
                {videoFile ? videoFile.name : "선택된 파일 없음"}
              </span>
            </div>

            {/* 썸네일 설정 */}
            <label className="intro-label">썸네일 (선택)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="intro-upload-btn"
                style={{ width: "auto" }}
                onClick={() => thumbInputRef.current?.click()}
                type="button"
              >
                파일 선택
              </button>
              <span style={{ fontSize: 13 }}>
                {thumbnailFile ? thumbnailFile.name : "선택된 파일 없음"}
              </span>
            </div>

            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="intro-file-input"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
            />

            {busy && (
              <div style={{ marginTop: 12 }}>
                {videoFile && <div>동영상 업로드: {videoProgress}%</div>}
                {thumbProgress > 0 && <div>썸네일 업로드 완료</div>}
              </div>
            )}

            <button
              className="intro-upload-btn"
              disabled={busy}
              onClick={handleUploadAll}
              type="button"
            >
              {busy ? "업로드 중…" : "업로드"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-3">목록</h2>

        <table className="intro-table-fixed">
          <thead>
            <tr>
              <th>주차</th>
              <th>제목</th>
              <th>영상</th>
              <th>업로드 날짜</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr
                key={v.weekNumber}
                className="border-b hover:bg-slate-50 transition"
              >
                <td className="p-3">{v.weekNumber}주차</td>
                <td className="p-3">{v.title}</td>
                <td className="p-3" style={{ textAlign: "center" }}>
                  {v.key ? (
                    <span title={v.key} style={{ cursor: "help" }}>🎬</span>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </td>
                <td className="p-3 text-slate-600">
                  {(v as any).createdAt?.slice(0, 10) ?? ""}
                </td>
                <td className="p-3">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(v);
                      }}
                      className="text-lg hover:opacity-70"
                      type="button"
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(v.weekNumber)}
                      className="text-lg hover:opacity-70"
                      type="button"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {videos.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  등록된 콘텐츠가 없습니다. + 버튼을 눌러 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Weekly Solution 전용 수정 모달 */}
      {selected && (
        <BalanceVideoDetailModal
          video={selected}
          program={program}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}
