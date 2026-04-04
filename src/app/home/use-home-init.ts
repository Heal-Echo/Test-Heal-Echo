"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn, getUserInfo } from "@/auth/user";
import { retryPendingSubscriptionSync } from "@/auth/subscription";
import { USER_API } from "@/config/constants";
import type { ProfileResponse } from "@/types/profile";
import * as storage from "@/lib/storage";
import { onAppResume, onNetworkRestore } from "@/lib/appLifecycle";
import { hydrateFromAWS, retryPendingProgramSync } from "@/lib/programSelection";

// =======================================================
// 프로필 AWS 재전송 함수 (모듈 레벨 — 중복 실행 방지)
// =======================================================
let syncInProgress = false;

async function retryPendingProfileSync(): Promise<void> {
  if (typeof window === "undefined") return;
  if (syncInProgress) return;

  const pending = storage.get("profile_aws_pending");
  if (pending !== "true") return;

  syncInProgress = true;

  try {
    const info = getUserInfo();
    const token = info?.idToken;
    if (!token) return;

    const profile = storage.getJSON("user_profile");
    if (!profile) return;

    const res = await fetch(USER_API.PROFILE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profile),
    });

    if (res.ok) {
      storage.remove("profile_aws_pending");
    } else {
      console.warn("[Profile] AWS 재업로드 실패:", res.status);
    }
  } catch (err) {
    console.warn("[Profile] AWS 재업로드 중 에러:", err);
  } finally {
    syncInProgress = false;
  }
}

/**
 * 홈 진입 시 초기화: 프로필 hydration, pending 재전송, 뒤로가기 방지
 * @param onHydrationComplete - hydration 완료 후 호출 (refreshConfirmedProgram)
 */
export function useHomeInit(onHydrationComplete: () => void) {
  const router = useRouter();

  // 🔐 보호 페이지: 로그인 여부 확인 + 첫 로그인 시 프로필 설정
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    // 프로필 설정 확인: 스토리지 레이어 → AWS fallback
    async function checkProfileSetup() {
      if (typeof window === "undefined") return;

      // 기존 키 → 사용자별 키 마이그레이션 (최초 1회)
      storage.migrateKey("user_profile");
      storage.migrateKey("profile_setup_done");
      storage.migrateKey("profile_aws_pending");

      const profileDone = storage.get("profile_setup_done");
      if (profileDone) {
        // pending 재시도: 스토리지에 데이터가 있지만 AWS 미전송인 경우
        await retryPendingProfileSync();
        await retryPendingProgramSync();
        await retryPendingSubscriptionSync();
        // 기존 사용자: 프로그램 선택 데이터가 AWS에만 있을 수 있으므로 hydrate
        await hydrateFromAWS();
        onHydrationComplete();
        return; // 프로필 완료 → 홈 유지
      }

      // 스토리지에 없음 → AWS에서 hydrate 시도
      try {
        const info = getUserInfo();
        const token = info?.idToken;
        if (token) {
          const res = await fetch(USER_API.PROFILE, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data: ProfileResponse = await res.json();

            // AWS 응답 구조 유연하게 처리:
            // 형태 A: { profile: { wellnessGoal, ... }, profileSetupDone: true }
            // 형태 B: { wellnessGoal, ..., profileSetupDone: true } (플랫 구조)
            const profile = data.profile || data;
            // profileSetupDone은 Lambda에서 실제 데이터 존재 여부도 함께 반영
            const setupDone = data.profileSetupDone || profile.profileSetupDone;

            if (setupDone) {
              // AWS에 프로필 존재 → 스토리지 레이어에 hydrate
              storage.setJSON("user_profile", profile);
              storage.set("profile_setup_done", "true");
              // 기존 사용자: 프로그램 선택 데이터도 함께 복원
              await hydrateFromAWS();
              onHydrationComplete();
              return; // 홈 유지
            }
          } else {
            // API 호출은 됐지만 서버 에러 (500 등) → 서버 장애일 수 있으므로
            // 프로필 설정 페이지로 보내지 않고 홈에 유지
            console.warn("[Profile] AWS 프로필 조회 서버 에러:", res.status);
            return;
          }
        }
      } catch (err) {
        // 네트워크 에러 등 → 서버 장애일 수 있으므로
        // 프로필 설정 페이지로 보내지 않고 홈에 유지
        console.warn("[Profile] AWS 프로필 조회 실패 (네트워크 에러):", err);
        return;
      }

      // AWS 응답이 정상이지만 프로필 데이터가 없는 경우에만 프로필 설정 페이지로 이동
      router.replace("/home/profile-setup");
    }

    checkProfileSetup();

    if (typeof window === "undefined") return;

    const handlePopState = () => {
      // 뒤로가기를 눌러도 다시 현재 홈 페이지를 스택에 쌓아서
      // 로그인/랜딩으로 돌아가지 못하게 함
      window.history.pushState(null, "", window.location.href);
    };

    // 현재 /home 상태를 한 번 더 쌓기
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    // 언마운트 시 정리
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  // =======================================================
  // P0 강화: 앱 복귀(visibilitychange) + 인터넷 복구(online) 시
  // pending 프로필 자동 재전송
  // =======================================================
  useEffect(() => {
    const retryAll = () => {
      retryPendingProfileSync();
      retryPendingProgramSync();
      retryPendingSubscriptionSync();
    };

    const cleanupResume = onAppResume(retryAll);
    const cleanupNetwork = onNetworkRestore(retryAll);

    return () => {
      cleanupResume();
      cleanupNetwork();
    };
  }, []);
}
