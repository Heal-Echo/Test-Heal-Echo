// components/adminStudio/WeeklyHabitStudio.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  listWeeklyHabitContent,
  createWeeklyHabitContent,
  updateWeeklyHabitContent,
  deleteWeeklyHabitContent,
  type WeeklyHabitContent,
} from "@/api/client";
import { makeThumbnailUrl, makeVideoUrl } from "@/config/constants";
import "@/components/adminStudio/intro.css";

type UploadedPart = { PartNumber: number; ETag: string };

export default function WeeklyHabitStudio({ folder }: { folder: string }) {
  const program = useMemo(() => folder.split("/").pop()!, [folder]);
  const S3_HABIT_ROOT = "weekly-habit";

  const [week, setWeek] = useState(1);
  const [contents, setContents] = useState<WeeklyHabitContent[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // 기존 영상/썸네일 키 (수정 모드에서 표시용)
  const [existingVideoKey, setExistingVideoKey] = useState<string | null>(null);
  const [existingThumbnailKey, setExistingThumbnailKey] = useState<string | null>(null);

  const [habitTitle, setHabitTitle] = useState("");
  const [habitDescription, setHabitDescription] = useState("");

  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const { items } = await listWeeklyHabitContent(program);
      setContents(items);
    } catch (err) {
      console.error("Failed to load weekly habit contents:", err);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  /* ================= multipart APIs ================= */
  async function mpInitiate(payload: any) {
    const res = await fetch(`/api/admin/weekly-habit/${program}/${week}/multipart/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function mpSignPart(payload: any) {
    const res = await fetch(`/api/admin/weekly-habit/${program}/${week}/multipart/part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function mpComplete(payload: any) {
    const res = await fetch(`/api/admin/weekly-habit/${program}/${week}/multipart/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  /* ================= upload ================= */
  const CHUNK_SIZE = 64 * 1024 * 1024;

  async function uploadVideoMultipart(): Promise<string | null> {
    if (!videoFile) return null;

    setVideoProgress(0);

    const videoId = `${program}-habit-week-${week}`;
    const folderPath = `${S3_HABIT_ROOT}/${program}/week-${week}`;
    const fileName = `${program}-habit-week-${week}.mp4`;

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

  async function uploadThumbnailSinglePut(): Promise<string | null> {
    if (!thumbnailFile) return null;

    setThumbProgress(0);

    const videoId = `${program}-habit-week-${week}`;
    const folderPath = `thumbnails/${S3_HABIT_ROOT}/${program}/week-${week}`;
    const fileName = `${program}-habit-week-${week}.jpg`;

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

    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: thumbnailFile,
    });
    const etag = res.headers.get("etag")!;

    const done = await mpComplete({
      key: init.key,
      uploadId: init.uploadId,
      parts: [{ PartNumber: 1, ETag: etag }],
    });

    setThumbProgress(100);
    return done.key;
  }

  /* ================= 저장 ================= */
  async function handleSave() {
    if (!habitTitle.trim()) {
      alert("습관 제목을 입력해주세요.");
      return;
    }

    try {
      setBusy(true);

      const videoKey = await uploadVideoMultipart();
      const thumbnailKey = await uploadThumbnailSinglePut();

      if (editMode) {
        await updateWeeklyHabitContent(program, week, {
          ...(videoKey && { videoKey }),
          ...(thumbnailKey && { thumbnailKey }),
          habitTitle,
          habitDescription,
        });
        alert("수정 완료");
      } else {
        await createWeeklyHabitContent(program, week, {
          ...(videoKey && { videoKey }),
          ...(thumbnailKey && { thumbnailKey }),
          habitTitle,
          habitDescription,
        });
        alert("등록 완료");
      }

      resetForm();
      await refresh();
    } catch (e) {
      console.error(e);
      alert("저장 중 오류 발생");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(targetWeek: number) {
    if (!confirm(`${targetWeek}주차 콘텐츠를 삭제하시겠습니까?`)) return;
    try {
      await deleteWeeklyHabitContent(program, targetWeek);
      alert("삭제 완료");
      await refresh();
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류 발생");
    }
  }

  function openEdit(content: WeeklyHabitContent) {
    setEditMode(true);
    setWeek(content.weekNumber);
    setHabitTitle(content.habitTitle);
    setHabitDescription(content.habitDescription);
    setVideoFile(null);
    setThumbnailFile(null);
    setExistingVideoKey(content.videoKey || null);
    setExistingThumbnailKey(content.thumbnailKey || null);
    setVideoProgress(0);
    setThumbProgress(0);
    setShowPopup(true);
  }

  function openNew() {
    setEditMode(false);
    setExistingVideoKey(null);
    setExistingThumbnailKey(null);
    resetForm();
    setShowPopup(true);
  }

  function resetForm() {
    setShowPopup(false);
    setEditMode(false);
    setVideoFile(null);
    setThumbnailFile(null);
    setExistingVideoKey(null);
    setExistingThumbnailKey(null);
    setHabitTitle("");
    setHabitDescription("");
    setVideoProgress(0);
    setThumbProgress(0);
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-10">
      {/* 새 콘텐츠 등록 버튼 */}
      <div className="intro-container">
        <div className="intro-upload-box" onClick={openNew}>
          <span className="intro-plus">+</span>
        </div>
      </div>

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="intro-file-input"
        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
      />

      {/* 등록/수정 모달 */}
      {showPopup && (
        <div className="intro-modal-overlay">
          <div
            className="intro-modal"
            style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
          >
            <button className="intro-close" onClick={resetForm}>
              ✕
            </button>

            <div className="intro-modal-title">
              {editMode ? "습관 콘텐츠 수정" : "습관 콘텐츠 등록"}
            </div>

            {/* 주차 선택 */}
            <label className="intro-label">주차 선택</label>
            <select
              className="intro-input"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={editMode}
            >
              {Array.from({ length: 52 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}주차
                </option>
              ))}
            </select>

            {/* 습관 제목 */}
            <label className="intro-label">이번 주 습관 제목</label>
            <input
              className="intro-input"
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              placeholder="예: 매일 10분 스트레칭"
            />

            {/* 습관 설명 */}
            <label className="intro-label">습관 설명</label>
            <textarea
              className="intro-textarea"
              rows={4}
              value={habitDescription}
              onChange={(e) => setHabitDescription(e.target.value)}
              placeholder="이번 주 습관에 대한 상세 설명을 작성하세요."
            />

            {/* 영상 업로드 */}
            <label className="intro-label">2분 영상 (선택)</label>

            {/* 기존 영상이 있으면 미리보기 표시 */}
            {editMode && existingVideoKey && !videoFile && (
              <div
                style={{
                  marginBottom: 8,
                  padding: "10px 14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ 기존 영상 등록됨</span>
                <div
                  style={{ marginTop: 6, color: "#4b5563", fontSize: 12, wordBreak: "break-all" }}
                >
                  {existingVideoKey.split("/").pop()}
                </div>
                <video
                  src={makeVideoUrl(existingVideoKey)}
                  controls
                  controlsList="nodownload"
                  className="rounded-md border bg-black mt-2 w-full max-w-[640px]"
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="intro-upload-btn"
                style={{ width: "auto" }}
                onClick={() => videoInputRef.current?.click()}
                type="button"
              >
                {editMode && existingVideoKey ? "영상 교체" : "영상 선택"}
              </button>
              <span style={{ fontSize: 13 }}>
                {videoFile
                  ? videoFile.name
                  : editMode && existingVideoKey
                    ? "새 영상을 선택하면 교체됩니다"
                    : "선택된 파일 없음"}
              </span>
            </div>

            {/* 썸네일 업로드 */}
            <label className="intro-label">썸네일 (선택)</label>

            {/* 기존 썸네일이 있으면 미리보기 표시 */}
            {editMode && existingThumbnailKey && !thumbnailFile && (
              <div
                style={{
                  marginBottom: 8,
                  padding: "10px 14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ 기존 썸네일 등록됨</span>
                <img
                  src={makeThumbnailUrl(existingThumbnailKey)}
                  alt="기존 썸네일"
                  style={{
                    width: "100%",
                    maxHeight: 120,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="intro-upload-btn"
                style={{ width: "auto" }}
                onClick={() => thumbInputRef.current?.click()}
                type="button"
              >
                {editMode && existingThumbnailKey ? "썸네일 교체" : "파일 선택"}
              </button>
              <span style={{ fontSize: 13 }}>
                {thumbnailFile
                  ? thumbnailFile.name
                  : editMode && existingThumbnailKey
                    ? "새 파일을 선택하면 교체됩니다"
                    : "선택된 파일 없음"}
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

            {/* 저장 버튼 */}
            <button className="intro-upload-btn" disabled={busy} onClick={handleSave} type="button">
              {busy ? "저장 중…" : editMode ? "수정 저장" : "등록"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-3">주차별 습관 콘텐츠</h2>

        <table className="intro-table-fixed">
          <thead>
            <tr>
              <th>주차</th>
              <th>습관 제목</th>
              <th>영상</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c) => (
              <tr key={c.weekNumber} className="border-b hover:bg-slate-50 transition">
                <td className="p-3">{c.weekNumber}주차</td>
                <td className="p-3">{c.habitTitle}</td>
                <td className="p-3" style={{ textAlign: "center" }}>
                  {c.videoKey ? (
                    <span title={c.videoKey} style={{ cursor: "help" }}>
                      🎬
                    </span>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </td>
                <td className="p-3 text-slate-600">{c.createdAt?.slice(0, 10) ?? ""}</td>
                <td className="p-3">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openEdit(c)}
                      className="text-lg hover:opacity-70"
                      type="button"
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(c.weekNumber)}
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

            {contents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  등록된 습관 콘텐츠가 없습니다. + 버튼을 눌러 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
