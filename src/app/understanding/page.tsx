"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./understanding.module.css";

import { isUserLoggedIn } from "@/auth/user";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

// ─────────────────────────────────────────────
// 세션 데이터: 이미지 + 배경 오디오 짝
// ─────────────────────────────────────────────
const sessions = [
  {
    id: 1,
    image: "/assets/sea-of-understanding/images/nature.png",
    audio: "/assets/sea-of-understanding/audio/Nature_Sound.mp3",
  },
  {
    id: 2,
    image: "/assets/sea-of-understanding/images/music.png",
    audio: "/assets/sea-of-understanding/audio/meditation_music.mp3",
  },
  {
    id: 3,
    image: "/assets/sea-of-understanding/images/campfire.png",
    audio: "/assets/sea-of-understanding/audio/campfire.mp3",
  },
  {
    id: 4,
    image: "/assets/sea-of-understanding/images/deep_bubble.png",
    audio: "/assets/sea-of-understanding/audio/deep_water_bubble.mp3",
  },
  {
    id: 5,
    image: "/assets/sea-of-understanding/images/raining.png",
    audio: "/assets/sea-of-understanding/audio/rain.mp3",
  },
];

// ─────────────────────────────────────────────
// 공통 오디오 소스 (세션 무관)
// ─────────────────────────────────────────────
const NARRATION_SRC =
  "/assets/sea-of-understanding/audio/narration_understanding.mp3";
const SINGING_BOWL_SRC =
  "/assets/sea-of-understanding/audio/singing_bowl.mp3";

// 싱잉볼 간격 옵션 (분)
const BOWL_INTERVAL_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];

// 최대 재생 시간 (초)
const MAX_PLAY_SECONDS = 120 * 60;

/** 오늘 날짜를 플레이 기록으로 AWS에 저장 */
function recordPlayDate() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const token = storage.getRaw("user_id_token");
  fetch("/api/user/practice-record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type: "understanding", date: today }),
  }).catch(() => {});
}

// ─────────────────────────────────────────────
// 시간 포맷 유틸
// ─────────────────────────────────────────────
function formatTime(time: number): string {
  if (isNaN(time) || time < 0) return "0:00";
  const min = Math.floor(time / 60);
  const sec = Math.floor(time % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function UnderstandingPage() {
  const router = useRouter();

  // ── 오디오 refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const singingBowlRef = useRef<HTMLAudioElement | null>(null);
  const bowlIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 기존 상태 ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── 멀티 오디오 상태 ──
  const [isNarrationMuted, setIsNarrationMuted] = useState(false);
  const [isSingingBowlMuted, setIsSingingBowlMuted] = useState(false);
  const [bowlInterval, setBowlInterval] = useState(5);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [narrationHasEnded, setNarrationHasEnded] = useState(false);

  // ── 스와이프 상태 (ref로 stale closure 방지) ──
  const dragStartXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const swipeOffsetRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const currentSession = sessions[currentIndex];

  // ─────────────────────────────────────────
  // 🔐 로그인 체크
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
    }
  }, [router]);

  // ─────────────────────────────────────────
  // 유틸: 싱잉볼 차임 재생
  // ─────────────────────────────────────────
  const playSingingBowlChime = useCallback(() => {
    const bowl = singingBowlRef.current;
    if (bowl) {
      bowl.currentTime = 0;
      bowl.play().catch(() => {});
    }
  }, []);

  // ─────────────────────────────────────────
  // 유틸: 싱잉볼 타이머 정리
  // ─────────────────────────────────────────
  const clearBowlTimers = useCallback(() => {
    if (bowlIntervalRef.current) {
      clearInterval(bowlIntervalRef.current);
      bowlIntervalRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────
  // 유틸: 모든 오디오 정지
  // ─────────────────────────────────────────
  const stopAllAudio = useCallback(() => {
    audioRef.current?.pause();
    narrationRef.current?.pause();

    singingBowlRef.current?.pause();
    clearBowlTimers();
  }, [clearBowlTimers]);

  // ─────────────────────────────────────────
  // 배경 오디오 소스 변경 (세션 전환 → 자동 재생)
  // ─────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    stopAllAudio();

    audio.src = currentSession.audio;
    audio.volume = isMuted ? 0 : volume;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setNarrationHasEnded(false);

    // 오디오 로드 완료 시 자동 재생 (배경음 + 내레이션)
    const onCanPlay = () => {
      audio.play().catch(() => {});
      if (narrationRef.current) {
        narrationRef.current.currentTime = 0;
        narrationRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
      recordPlayDate();
      audio.removeEventListener("canplay", onCanPlay);
    };
    audio.addEventListener("canplay", onCanPlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ─────────────────────────────────────────
  // 마스터 볼륨 동기화 (모든 오디오 소스)
  // ─────────────────────────────────────────
  useEffect(() => {
    const masterVol = isMuted ? 0 : volume;

    if (audioRef.current) {
      audioRef.current.volume = masterVol;
    }
    if (narrationRef.current) {
      narrationRef.current.volume =
        isMuted || isNarrationMuted ? 0 : volume;
    }
    if (singingBowlRef.current) {
      singingBowlRef.current.volume =
        isMuted || isSingingBowlMuted ? 0 : volume;
    }
  }, [volume, isMuted, isNarrationMuted, isSingingBowlMuted]);

  // ─────────────────────────────────────────
  // 배경 오디오 이벤트 리스너
  // ─────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      if (t >= MAX_PLAY_SECONDS) {
        stopAllAudio();
        audio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTime(0);
        setNarrationHasEnded(false);
        return;
      }
      setCurrentTime(t);
    };

    const onLoadedMetadata = () => setDuration(MAX_PLAY_SECONDS);

    const onEnded = () => {
      stopAllAudio();
      setIsPlaying(false);
      setNarrationHasEnded(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [stopAllAudio]);

  // ─────────────────────────────────────────
  // 내레이션 종료 이벤트
  // ─────────────────────────────────────────
  useEffect(() => {
    const narration = narrationRef.current;
    if (!narration) return;

    const onNarrationEnded = () => {
      setNarrationHasEnded(true);
    };

    narration.addEventListener("ended", onNarrationEnded);
    return () => {
      narration.removeEventListener("ended", onNarrationEnded);
    };
  }, []);

  // ─────────────────────────────────────────
  // 싱잉볼 인터벌 관리
  // 내레이션 무음이거나 내레이션 종료 시 차임 시작
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || isSingingBowlMuted) {
      clearBowlTimers();
      return;
    }

    // 내레이션 무음이거나 이미 종료된 경우 → 즉시 차임 시작
    if (isNarrationMuted || narrationHasEnded) {
      clearBowlTimers();
      playSingingBowlChime();
      const intervalMs = bowlInterval * 60 * 1000;
      bowlIntervalRef.current = setInterval(
        playSingingBowlChime,
        intervalMs
      );
    }
    // 내레이션 재생 중이면 종료 이벤트에서 narrationHasEnded 가 true 로 변경됨

    return () => clearBowlTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isNarrationMuted, isSingingBowlMuted, bowlInterval, narrationHasEnded]);

  // ─────────────────────────────────────────
  // 언마운트 시 모든 오디오 정리
  // ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  // ─────────────────────────────────────────
  // 재생 컨트롤
  // ─────────────────────────────────────────
  const handlePlay = useCallback(() => {
    // 배경음 재생
    audioRef.current?.play();

    // 내레이션은 항상 재생 (무음이라도 소리 없이 계속 play)
    if (narrationRef.current) {
      narrationRef.current.currentTime = 0;
      narrationRef.current.play().catch(() => {});
    }
    setNarrationHasEnded(false);

    setIsPlaying(true);
    recordPlayDate();
    // 싱잉볼 인터벌은 위의 useEffect에서 isPlaying 변경을 감지해 자동 시작
  }, []);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    narrationRef.current?.pause();

    singingBowlRef.current?.pause();
    clearBowlTimers();
    setIsPlaying(false);
  }, [clearBowlTimers]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (narrationRef.current) {
      narrationRef.current.pause();
      narrationRef.current.currentTime = 0;
    }
    if (singingBowlRef.current) {
      singingBowlRef.current.pause();
      singingBowlRef.current.currentTime = 0;
    }
    clearBowlTimers();
    setIsPlaying(false);
    setCurrentTime(0);
    setNarrationHasEnded(false);
  }, [clearBowlTimers]);

  // ─────────────────────────────────────────
  // 프로그레스 / 볼륨 핸들러
  // ─────────────────────────────────────────
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (audio) {
        const newTime = Number(e.target.value);
        audio.currentTime = newTime;

        // 내레이션 동기화
        const narration = narrationRef.current;
        if (narration) {
          const narDuration = narration.duration || 0;

          if (newTime < 0.5) {
            // 처음으로 이동 → 내레이션도 처음부터 재시작
            narration.currentTime = 0;
            if (isPlaying) {
              narration.play().catch(() => {});
            }
            setNarrationHasEnded(false);
          } else if (narDuration > 0 && newTime >= narDuration) {
            // 내레이션 길이를 초과 → 내레이션 종료 처리
            narration.pause();
            setNarrationHasEnded(true);
          }
        }
      }
    },
    [isPlaying]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = Number(e.target.value);
      setVolume(newVol);
      if (newVol > 0) {
        setIsMuted(false);
        setPrevVolume(newVol);
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume > 0 ? prevVolume : 0.7);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume]);

  // ─────────────────────────────────────────
  // 내레이션 토글
  // ─────────────────────────────────────────
  const toggleNarration = useCallback(() => {
    // 내레이션은 항상 재생 중 — 볼륨만 0 ↔ 정상 전환
    // 볼륨 동기화는 useEffect에서 자동 처리
    setIsNarrationMuted((prev) => !prev);
  }, []);

  // ─────────────────────────────────────────
  // 싱잉볼 토글
  // ─────────────────────────────────────────
  const toggleSingingBowl = useCallback(() => {
    setIsSingingBowlMuted((prev) => {
      if (!prev) {
        // 음소거 전환 → 현재 차임 정지
        singingBowlRef.current?.pause();
        if (singingBowlRef.current) singingBowlRef.current.currentTime = 0;
      }
      return !prev;
    });
  }, []);

  // ─────────────────────────────────────────
  // 싱잉볼 간격 변경
  // ─────────────────────────────────────────
  const handleBowlIntervalChange = useCallback((minutes: number) => {
    setBowlInterval(minutes);
    setShowIntervalPicker(false);
  }, []);

  // ─────────────────────────────────────────
  // 세션 이동 (스와이프 완료 시)
  // ─────────────────────────────────────────
  const goToSession = useCallback(
    (direction: number) => {
      const next = currentIndex + direction;
      if (next >= 0 && next < sessions.length) {
        setCurrentIndex(next);
      }
    },
    [currentIndex]
  );

  // ─────────────────────────────────────────
  // 스와이프 완료 공통 로직
  // ─────────────────────────────────────────
  const finishSwipe = useCallback(() => {
    const offset = swipeOffsetRef.current;
    const threshold = 50;
    if (offset < -threshold) {
      goToSession(1);
    } else if (offset > threshold) {
      goToSession(-1);
    }
    isDraggingRef.current = false;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, [goToSession]);

  // ─────────────────────────────────────────
  // 터치 스와이프
  // ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const offset = e.touches[0].clientX - dragStartXRef.current;
    swipeOffsetRef.current = offset;
    setSwipeOffset(offset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    finishSwipe();
  }, [finishSwipe]);

  // ─────────────────────────────────────────
  // 마우스 드래그 스와이프 (데스크톱)
  // ─────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, a")) return;
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    isDraggingRef.current = true;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const offset = e.clientX - dragStartXRef.current;
    swipeOffsetRef.current = offset;
    setSwipeOffset(offset);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    finishSwipe();
  }, [finishSwipe]);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      finishSwipe();
    }
  }, [finishSwipe]);

  // ─────────────────────────────────────────
  // 인터벌 피커 외부 클릭 닫기
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!showIntervalPicker) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.intervalWrapper}`)) {
        setShowIntervalPicker(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showIntervalPicker]);

  // ─────────────────────────────────────────
  // 프로그레스 / 볼륨 바 배경 계산
  // ─────────────────────────────────────────
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const volumePercent = volume * 100;

  const progressStyle: React.CSSProperties = {
    background: `linear-gradient(to right, rgba(255,255,255,0.8) ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
  };

  const volumeStyle: React.CSSProperties = {
    background: `linear-gradient(to right, rgba(255,255,255,0.8) ${volumePercent}%, rgba(255,255,255,0.15) ${volumePercent}%)`,
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  return (
    <div className={styles.container}>
      <Header />

      <main
        className={styles.main}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── 이미지 배경 레이어 (프레임 전체) ── */}
        <div className={styles.imageArea}>
          <div
            className={styles.imageSlider}
            style={{
              transform: `translateX(calc(-${currentIndex * 100}% + ${swipeOffset}px))`,
              transition: swipeOffset !== 0 ? "none" : "transform 0.4s ease",
            }}
          >
            {sessions.map((session, index) => (
              <div key={session.id} className={styles.imageSlide}>
                <Image
                  src={session.image}
                  alt={`명상 세션 ${index + 1}`}
                  fill
                  sizes="(max-width: 720px) 100vw, 720px"
                  className={styles.sessionImage}
                  priority={index === 0}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── 컨텐츠 오버레이 ── */}
        <div className={styles.contentLayer}>
          <div className={styles.contentSpacer} />

          <div className={styles.dots}>
            {sessions.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${
                  index === currentIndex ? styles.dotActive : ""
                }`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`세션 ${index + 1}`}
              />
            ))}
          </div>

          <div className={styles.playerArea}>
            <div className={styles.progressGroup}>
              <span className={styles.time}>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleProgressChange}
                className={styles.progressBar}
                style={progressStyle}
                aria-label="재생 위치"
              />
              <span className={styles.time}>{formatTime(duration)}</span>
            </div>

            <div className={styles.extraControls}>
              <button
                className={`${styles.audioToggleBtn} ${
                  isNarrationMuted
                    ? styles.audioToggleOff
                    : styles.audioToggleOn
                }`}
                onClick={toggleNarration}
                aria-label={
                  isNarrationMuted ? "내레이션 켜기" : "내레이션 끄기"
                }
              >
                {isNarrationMuted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
                <span className={styles.audioToggleLabel}>내레이션</span>
              </button>

              <div className={styles.bowlGroup}>
                <button
                  className={`${styles.audioToggleBtn} ${
                    isSingingBowlMuted
                      ? styles.audioToggleOff
                      : styles.audioToggleOn
                  }`}
                  onClick={toggleSingingBowl}
                  aria-label={
                    isSingingBowlMuted ? "싱잉볼 켜기" : "싱잉볼 끄기"
                  }
                >
                  {isSingingBowlMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C9.37 5.13 8.19 6.21 7.56 7.57L18 18zM3.63 3.19L2.21 4.61 5.88 8.28C5.68 8.82 5.5 9.39 5.5 10v5l-2 2v1h14.11l1.78 1.78 1.41-1.41L3.63 3.19z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                    </svg>
                  )}
                  <span className={styles.audioToggleLabel}>싱잉볼</span>
                </button>

                <div className={styles.intervalWrapper}>
                  <button
                    className={styles.intervalDisplay}
                    onClick={() => setShowIntervalPicker((prev) => !prev)}
                    aria-label="싱잉볼 간격 설정"
                  >
                    {bowlInterval}분
                  </button>
                  {showIntervalPicker && (
                    <div className={styles.intervalPicker}>
                      <p className={styles.intervalPickerTitle}>싱잉볼 간격</p>
                      <div className={styles.intervalOptions}>
                        {BOWL_INTERVAL_OPTIONS.map((min) => (
                          <button
                            key={min}
                            className={`${styles.intervalOption} ${
                              min === bowlInterval
                                ? styles.intervalOptionActive
                                : ""
                            }`}
                            onClick={() => handleBowlIntervalChange(min)}
                          >
                            {min}분
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.controls}>
              <button
                className={styles.controlBtn}
                onClick={handleStop}
                aria-label="정지"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>

              {isPlaying ? (
                <button className={styles.playBtn} onClick={handlePause} aria-label="일시정지">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </button>
              ) : (
                <button className={styles.playBtn} onClick={handlePlay} aria-label="재생">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="7,3 21,12 7,21" />
                  </svg>
                </button>
              )}

              <div className={styles.volumeGroup}>
                <button
                  className={styles.muteBtn}
                  onClick={toggleMute}
                  aria-label={isMuted ? "음소거 해제" : "음소거"}
                >
                  {isMuted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={styles.volumeIcon}>
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={styles.volumeIcon}>
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  className={styles.volumeBar}
                  style={volumeStyle}
                  aria-label="볼륨 조절"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 히든 오디오 ── */}
        <audio ref={audioRef} preload="metadata" />
        <audio ref={narrationRef} src={NARRATION_SRC} preload="metadata" />
        <audio ref={singingBowlRef} src={SINGING_BOWL_SRC} preload="metadata" />
      </main>

      <div className={styles.tabPadding}></div>
      <BottomTab />
    </div>
  );
}
