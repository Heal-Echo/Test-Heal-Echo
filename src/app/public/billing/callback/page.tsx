"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUserLoggedIn, getValidUserInfo } from "@/auth/user";
import { getSubscription } from "@/auth/subscription";
import styles from "./callback.module.css";
import { setSession } from "@/lib/storage";
import { syncProgramSelection } from "@/lib/program-selection";

type CallbackState = "processing" | "success" | "error";

function BillingCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processedRef = useRef(false);

  useEffect(() => {
    // 중복 실행 방지
    if (processedRef.current) return;
    processedRef.current = true;

    async function processCallback() {
      try {
        // 로그인 확인
        if (!isUserLoggedIn()) {
          router.replace("/public/login");
          return;
        }

        // 실패 콜백인지 확인
        const status = searchParams.get("status");
        if (status === "fail") {
          const code = searchParams.get("code") || "";
          const message = searchParams.get("message") || "카드 등록 중 오류가 발생했습니다.";
          setErrorMessage(message);
          setState("error");
          console.error("[BillingCallback] Billing auth failed:", code, message);
          return;
        }

        // ─────────────────────────────────────────
        // 빌링 인증 콜백 (requestBillingAuth → authKey, customerKey)
        // URL 파라미터에서 모든 데이터를 읽음 (localStorage 미사용)
        // ─────────────────────────────────────────
        const authKey = searchParams.get("authKey");
        const customerKey = searchParams.get("customerKey");
        const programId = searchParams.get("programId") || "autobalance";
        const planType = searchParams.get("planType") || "monthly";

        if (!authKey || !customerKey) {
          setErrorMessage("카드 등록 정보가 올바르지 않습니다. 다시 시도해주세요.");
          setState("error");
          return;
        }

        // ★ 유효한 인증 토큰 보장 (만료 시 자동 갱신)
        const validInfo = await getValidUserInfo();
        if (!validInfo) {
          setSession("redirect_after_login", "/public/billing/callback" + window.location.search);
          router.replace("/public/login");
          return;
        }
        const token = validInfo.idToken;

        // ★ API 호출: 빌링키 발급 (authKey → billingKey)
        // issue-key API가 토스 빌링키 발급 + 구독 상태 업데이트를 처리
        const res = await fetch("/api/user/billing/issue-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            authKey,
            customerKey,
            programId,
            planType,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setErrorMessage(data.error || "카드 등록에 실패했습니다. 다시 시도해주세요.");
          setState("error");
          return;
        }

        // 서버에서 구독 정보 다시 fetch → 캐시 갱신
        try {
          await getSubscription(programId);
        } catch {}

        // 솔루션 선택 동기화 (weekly_habit 키 + AWS preferences 저장)
        // 무료 체험 시작 후 Weekly Habit 방문 시 다시 선택하지 않도록
        syncProgramSelection(programId);

        setState("success");

        // 2초 후 솔루션 페이지로 이동
        setTimeout(() => {
          router.replace("/wellness/solution");
        }, 2000);
      } catch (err: any) {
        console.error("[BillingCallback] Error:", err);
        setErrorMessage("카드 등록 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
        setState("error");
      }
    }

    processCallback();
  }, [router, searchParams]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {state === "processing" && (
          <>
            <div className={styles.spinner} />
            <h2 className={styles.title}>카드 등록 처리 중...</h2>
            <p className={styles.desc}>잠시만 기다려주세요.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.title}>7일 무료 체험이 시작되었습니다!</h2>
            <p className={styles.desc}>
              지금부터 모든 주차의 영상을 자유롭게 시청할 수 있어요.
              <br />
              7일 이내에 언제든 취소할 수 있습니다.
            </p>
            <p className={styles.redirect}>솔루션 페이지로 이동합니다...</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className={styles.errorIcon}>!</div>
            <h2 className={styles.title}>카드 등록 실패</h2>
            <p className={styles.desc}>{errorMessage}</p>
            <div className={styles.btnGroup}>
              <button className={styles.retryBtn} onClick={() => router.push("/home/pricing")}>
                다시 시도
              </button>
              <button className={styles.backBtn} onClick={() => router.push("/wellness/solution")}>
                돌아가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingCallbackPage() {
  return (
    <Suspense fallback={null}>
      <BillingCallbackPageContent />
    </Suspense>
  );
}
