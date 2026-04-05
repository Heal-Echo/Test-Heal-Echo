"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/header";
import BottomTab from "@/components/bottom-tab";
import styles from "./change-payment.module.css";
import { isUserLoggedIn, getValidUserInfo } from "@/auth/user";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";
import { TOSS_CLIENT_KEY } from "@/config/constants";

// ─────────────────────────────────────────
// 페이지 상태
// ─────────────────────────────────────────
type PageState =
  | "idle" // 초기 — 현재 카드 정보 표시 + "새 카드 등록" 버튼
  | "loading" // 토스 SDK 로딩 중
  | "processing" // 콜백 처리 중 (authKey → issue-key API)
  | "success" // 변경 완료
  | "error"; // 오류

function ChangePaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentCard, setCurrentCard] = useState<{
    cardCompany: string;
    cardLast4: string;
  } | null>(null);

  // ─── 로그인 확인 + 현재 카드 정보 로드 ───
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    async function loadBillingInfo() {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/billing/info?programId=autobalance", {
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.found && data.cardLast4) {
            setCurrentCard({
              cardCompany: data.cardCompany || "",
              cardLast4: data.cardLast4,
            });
          }
        }
      } catch (err) {
        console.error("[ChangePayment] billing/info failed:", err);
      }
    }
    loadBillingInfo();
  }, [router]);

  // ─── 콜백 처리 (토스 리다이렉트 후) ───
  useEffect(() => {
    if (processedRef.current) return;

    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");
    const status = searchParams.get("status");

    // 실패 콜백
    if (status === "fail") {
      processedRef.current = true;
      const message = searchParams.get("message") || "카드 등록 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setPageState("error");
      return;
    }

    // 성공 콜백 (authKey + customerKey가 있으면)
    if (!authKey || !customerKey) return;

    processedRef.current = true;
    setPageState("processing");

    async function processKeyChange() {
      try {
        const validInfo = await getValidUserInfo();
        if (!validInfo) {
          router.replace("/public/login");
          return;
        }

        const res = await fetch("/api/user/billing/update-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validInfo.idToken}`,
          },
          body: JSON.stringify({
            authKey,
            customerKey,
            programId: searchParams.get("programId") || "autobalance",
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setErrorMessage(data.error || "카드 변경에 실패했습니다. 다시 시도해주세요.");
          setPageState("error");
          return;
        }

        setPageState("success");

        // 2초 후 구독 관리 페이지로 복귀
        setTimeout(() => {
          router.replace("/mypage/settings/subscription");
        }, 2000);
      } catch (err) {
        console.error("[ChangePayment] Error:", err);
        setErrorMessage("카드 변경 처리 중 오류가 발생했습니다.");
        setPageState("error");
      }
    }

    processKeyChange();
  }, [router, searchParams]);

  // ─── 새 카드 등록 (토스 SDK 호출) ───
  async function handleChangeCard() {
    setPageState("loading");

    try {
      const validInfo = await getValidUserInfo();
      if (!validInfo) {
        router.replace("/public/login");
        return;
      }

      const email = validInfo.email || "guest";
      const customerKey = email.replace(/[^a-zA-Z0-9@._-]/g, "").slice(0, 50);

      const callbackBase = `${window.location.origin}/mypage/settings/subscription/change-payment`;
      const successParams = new URLSearchParams({
        programId: "autobalance",
        planType: "monthly",
      });
      const failParams = new URLSearchParams({
        status: "fail",
        programId: "autobalance",
      });

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${callbackBase}?${successParams.toString()}`,
        failUrl: `${callbackBase}?${failParams.toString()}`,
        customerEmail: validInfo.email || undefined,
      });
    } catch (err) {
      console.error("[ChangePayment] Toss SDK error:", err);
      setErrorMessage("카드 등록 화면을 불러오는 데 실패했습니다.");
      setPageState("error");
    }
  }

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* 뒤로가기 + 타이틀 */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>결제 수단 변경</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* ── idle: 현재 카드 + 변경 버튼 ── */}
        {pageState === "idle" && (
          <section className={styles.cardSection}>
            <div className={styles.currentCardBox}>
              <span className={styles.currentCardLabel}>현재 결제 수단</span>
              {currentCard ? (
                <span className={styles.currentCardValue}>
                  {currentCard.cardCompany} **** {currentCard.cardLast4}
                </span>
              ) : (
                <span className={styles.currentCardEmpty}>등록된 카드가 없습니다</span>
              )}
            </div>

            <p className={styles.changeDesc}>
              새 카드를 등록하면 기존 결제 수단이 자동으로 교체됩니다.
              <br />
              다음 결제일부터 새 카드로 결제가 진행됩니다.
            </p>

            <button className={styles.changeBtn} onClick={handleChangeCard}>
              새 카드 등록하기
            </button>

            <button className={styles.cancelBtn} onClick={() => router.back()}>
              취소
            </button>
          </section>
        )}

        {/* ── loading: 토스 SDK 로딩 ── */}
        {pageState === "loading" && (
          <section className={styles.statusSection}>
            <div className={styles.spinner} />
            <h2 className={styles.statusTitle}>카드 등록 화면을 불러오는 중...</h2>
            <p className={styles.statusDesc}>잠시만 기다려주세요.</p>
          </section>
        )}

        {/* ── processing: 빌링키 교체 처리 중 ── */}
        {pageState === "processing" && (
          <section className={styles.statusSection}>
            <div className={styles.spinner} />
            <h2 className={styles.statusTitle}>결제 수단 변경 처리 중...</h2>
            <p className={styles.statusDesc}>잠시만 기다려주세요.</p>
          </section>
        )}

        {/* ── success: 변경 완료 ── */}
        {pageState === "success" && (
          <section className={styles.statusSection}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.statusTitle}>결제 수단이 변경되었습니다</h2>
            <p className={styles.statusDesc}>다음 결제일부터 새 카드로 결제가 진행됩니다.</p>
            <p className={styles.redirect}>구독 관리 페이지로 이동합니다...</p>
          </section>
        )}

        {/* ── error: 오류 ── */}
        {pageState === "error" && (
          <section className={styles.statusSection}>
            <div className={styles.errorIcon}>!</div>
            <h2 className={styles.statusTitle}>카드 변경 실패</h2>
            <p className={styles.statusDesc}>{errorMessage}</p>
            <div className={styles.btnGroup}>
              <button
                className={styles.retryBtn}
                onClick={() => {
                  setPageState("idle");
                  setErrorMessage("");
                }}
              >
                다시 시도
              </button>
              <button
                className={styles.backLinkBtn}
                onClick={() => router.push("/mypage/settings/subscription")}
              >
                구독 관리로 돌아가기
              </button>
            </div>
          </section>
        )}
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}

export default function ChangePaymentPage() {
  return (
    <Suspense fallback={null}>
      <ChangePaymentPageContent />
    </Suspense>
  );
}
