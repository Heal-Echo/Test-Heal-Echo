"use client";

import React, { useState } from "react";
import IntroModal from "./intro-modal";
import "./intro.css";

export default function IntroUploader() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 사용자가 큰 박스를 클릭했을 때 → 파일 선택
  function handleSelectVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setVideoFile(file);
      setShowModal(true); // 모달 열기
    }
  }

  return (
    <div className="intro-container">
      {/* 업로드 큰 박스 */}
      <label className="intro-upload-box">
        <input
          type="file"
          accept="video/*"
          className="intro-file-input"
          onChange={handleSelectVideo}
        />
        <span className="intro-plus">+</span>
      </label>

      {/* 모달 */}
      {showModal && videoFile && (
        <IntroModal
          videoFile={videoFile}
          onClose={() => {
            setShowModal(false);
            setVideoFile(null);
          }}
        />
      )}
    </div>
  );
}
