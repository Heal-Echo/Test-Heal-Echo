"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./landing.module.css";

import { makeVideoUrl, makeThumbnailUrl } from "@/config/constants";

// 서버 컴포넌트(page.tsx)에서 전달받는 비디오 데이터 타입
type IntroVideoProps = {
  videoKey: string | null;
  thumbnailKey: string | null;
  error: string | null;
};

export default function IntroVideoClient({
  videoKey,
  thumbnailKey,
  error,
}: IntroVideoProps) {
  // ▶ 플레이 버튼 & 재생 제어용 ref
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ▶ 비디오 활성화 상태 (재생 버튼 클릭 전까지 video 태그 미생성)
  const [videoActivated, setVideoActivated] = useState(false);

  // ▶ 오버레이 재생 버튼 — 클릭 시 비디오 활성화
  const handleOverlayPlay = () => {
    setVideoActivated(true);
  };

  // ▶ 비디오 활성화 후 자동 재생
  useEffect(() => {
    if (videoActivated && videoRef.current) {
      videoRef.current.play();
    }
  }, [videoActivated]);

  return (
    <section id="introduction" className={styles.introSection}>
      <div className={styles.container}>
        <h2 className={styles.introTitle}>
          10년의 여정이 만든, 하루 15분의 변화
        </h2>
        <div className={styles.introVideo}>
          {/* 에러 */}
          {error && (
            <div className={styles.introPlaceholder}>
              <p className={styles.introMsgError}>{error}</p>
            </div>
          )}

          {/* 영상 없음 */}
          {!error && !videoKey && (
            <div className={styles.introPlaceholder}>
              <p className={styles.introMsg}>아직 등록된 Introduction 영상이 없습니다.</p>
            </div>
          )}

          {/* 영상 있음: 재생 전에는 썸네일만, 재생 후에는 비디오 */}
          {!error && videoKey && (
            <>
              {!videoActivated ? (
                /* 썸네일 + 재생 버튼 (비디오 파일 미로드) */
                <div className={styles.introThumbnailWrap}>
                  {thumbnailKey && (
                    <Image
                      src={makeThumbnailUrl(thumbnailKey)}
                      alt="소개 영상 썸네일"
                      fill
                      sizes="(max-width: 480px) 100vw, (max-width: 640px) 90vw, (max-width: 1024px) 720px, 640px"
                      className={styles.introThumbnailImg}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.videoOverlayCenter}
                    onClick={handleOverlayPlay}
                    aria-label="영상 재생"
                  />
                </div>
              ) : (
                /* 비디오 활성화: 실제 video 태그 렌더링 */
                <video
                  id="introVideo"
                  ref={videoRef}
                  autoPlay
                  controls
                  playsInline
                  controlsList="nodownload"
                  preload="metadata"
                >
                  <source
                    src={makeVideoUrl(videoKey)}
                    type="video/mp4"
                  />
                  브라우저가 HTML5 비디오를 지원하지 않습니다.
                </video>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
