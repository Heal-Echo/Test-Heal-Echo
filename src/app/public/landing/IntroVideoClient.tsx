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

  // ▶ 비디오 재생 에러 상태
  const [playbackError, setPlaybackError] = useState(false);

  // ▶ 비디오 재생 완료 상태
  const [videoEnded, setVideoEnded] = useState(false);

  // ▶ 오버레이 재생 버튼 — 클릭 시 비디오 활성화
  const handleOverlayPlay = () => {
    setPlaybackError(false);
    setVideoEnded(false);
    setVideoActivated(true);
  };

  // ▶ 다시 보기 — 영상을 처음으로 되돌려 재생
  const handleReplay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    setVideoEnded(false);
  };

  // ▶ 비디오 로딩/재생 에러 핸들러
  const handleVideoError = () => {
    setPlaybackError(true);
  };

  // ▶ 비디오 활성화 후 자동 재생
  useEffect(() => {
    if (videoActivated && videoRef.current) {
      videoRef.current.play().catch(() => {
        // autoplay blocked or source error — handled by onError
      });
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
              ) : playbackError ? (
                /* 비디오 로딩/재생 실패 시 안내 */
                <div className={styles.introPlaceholder}>
                  <p className={styles.introMsgError}>
                    영상을 재생할 수 없습니다. 잠시 후 다시 시도해 주세요.
                  </p>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleOverlayPlay}
                    style={{ marginTop: "16px" }}
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                /* 비디오 활성화: 실제 video 태그 렌더링 */
                <div className={styles.introVideoWrap}>
                  <video
                    id="introVideo"
                    ref={videoRef}
                    autoPlay
                    controls
                    playsInline
                    controlsList="nodownload"
                    preload="metadata"
                    onError={handleVideoError}
                    onEnded={() => setVideoEnded(true)}
                  >
                    <source
                      src={makeVideoUrl(videoKey)}
                      type="video/mp4"
                    />
                    브라우저가 HTML5 비디오를 지원하지 않습니다.
                  </video>

                  {videoEnded && (
                    <button
                      type="button"
                      className={styles.videoReplayBtn}
                      onClick={handleReplay}
                      aria-label="영상 다시 보기"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
