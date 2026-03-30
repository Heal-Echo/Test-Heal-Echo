"use client";

import React, { useState } from "react";
import axios from "axios";
import {
  initiateUpload,
  completeUpload,
  updateVideo,
  listVideos,
} from "@/api/client";
import "./intro.css";

export default function IntroModal({
  videoFile,
  onClose,
}: {
  videoFile: File;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("Introduction");
  const [description, setDescription] = useState("Heal Echo 소개 영상");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);

  function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setThumbnail(f);
    if (f) {
      setThumbPreview(URL.createObjectURL(f));
    }
  }

  async function handleUpload() {
    setBusy(true);

    try {
      /** 1) 비디오 업로드 */
      const initVideo = await initiateUpload({
        fileName: videoFile.name,
        fileType: videoFile.type,
        title,
        description,
        folder: "videos/featured",
        videoId: "featured",
      });

      await axios.put(initVideo.uploadUrl, videoFile, {
        headers: { "Content-Type": initVideo.contentType },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });

      /** 2) 썸네일 업로드 */
      let thumbnailKey = null;

      if (thumbnail) {
        const initThumb = await initiateUpload({
          fileName: thumbnail.name,
          fileType: thumbnail.type,
          title,
          description,
          folder: "thumbnails/featured",
          videoId: "featured",
        });

        await axios.put(initThumb.uploadUrl, thumbnail, {
          headers: { "Content-Type": initThumb.contentType },
        });

        thumbnailKey = initThumb.key;
      }

      /** 3) completeUpload */
      await completeUpload("featured", {
        key: initVideo.key,
        thumbnailKey: thumbnailKey ?? undefined,
        title,
        description,
      });      

      alert("Introduction 업로드 성공!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="intro-modal-overlay">
      <div className="intro-modal">
        <button className="intro-close" onClick={onClose}>
          ✕
        </button>

        <h2 className="intro-modal-title">세부 정보</h2>

        {/* 제목 */}
        <label className="intro-label">제목</label>
        <input
          className="intro-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* 설명 */}
        <label className="intro-label">설명</label>
        <textarea
          className="intro-textarea"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* 썸네일 선택 */}
        <label className="intro-label">썸네일 설정</label>
        <input type="file" accept="image/*" onChange={handleThumbnailChange} />

        {thumbPreview && (
          <img src={thumbPreview} className="intro-thumbnail-preview" />
        )}

        {/* 업로드 버튼 */}
        <button
          className="intro-upload-btn"
          disabled={busy}
          onClick={handleUpload}
        >
          {busy ? "업로드 중..." : "업로드"}
        </button>

        {/* 진행률 */}
        {progress > 0 && (
          <p className="intro-progress">진행률: {progress}%</p>
        )}
      </div>
    </div>
  );
}
