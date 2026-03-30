// src/app/mypage/settings/withdraw/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./withdraw.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import { isUserLoggedIn, getValidUserInfo, userLogout } from "@/auth/user";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

const REASONS = [
  "사용 빈도가 낮아요",
  "콘텐츠가 만족스럽지 않아요",
  "다른 서비스를 이용할 예정이에요",
  "개인정보가 걱정돼요",
  "기타",
];

const CONFIRM_TEXT = "탈퇴합니다";

export default function WithdrawPage() {
  const router = useRouter();

  // ── 스텝 (1: 사유 선택, 2: 확인 텍스트, 3: 비밀번호) ──
  const [step, setStep] = useState(1);

  // ── 입력값 ──
  const [reason, setReason] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [password, setPassword] = useState("");

  // ── 상태 ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [done, setDone] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // ── 마운트 시: 로그인 확인 + 구독 상태 체크 ──
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    async function checkSubscription() {
      try {
        const userInfo = await getValidUserInfo();
        if (!userInfo?.idToken) {
          router.replace("/public/login");
          return;
        }

        // 구독 상태 확인 API 호출
        const res = await fetch("/api/user/subscription", {
          headers: { Authorization: `Bearer ${userInfo.idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          // items 배열에서 활성 paid/free_trial 구독 확인
          const items = data.items || data.subscriptions || [];
          const hasActive = Array.isArray(items) && items.some(
            (s: any) =>
              (s.subscriptionType === "paid" || s.subscriptionType === "free_trial") &&
              s.status === "active"
          );
          if (hasActive) {
            setBlocked(true);
          }
        }
      } catch (err) {
        console.error("구독 상태 확인 실패:", err);
      } finally {
        setCheckingSubscription(false);
      }
    }

    checkSubscription();
  }, [router]);

  // ── 다음 단계 ──
  function handleNext() {
    setError("");
    if (step === 1 && reason) {
      setStep(2);
    } else if (step === 2 && confirmInput === CONFIRM_TEXT) {
      setStep(3);
    }
  }

  // ── 탈퇴 요청 ──
  async function handleWithdraw() {
    setError("");
    setLoading(true);

    try {
      const userInfo = await getValidUserInfo();
      if (!userInfo?.idToken) {
        router.replace("/public/login");
        return;
      }

      const res = await fetch("/api/user/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.idToken}`,
        },
        body: JSON.stringify({
          reason,
          confirmText: confirmInput,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "ACTIVE_SUBSCRIPTION") {
          setBlocked(true);
          return;
        }
        if (data.code === "INVALID_PASSWORD") {
          setError("비밀번호가 올바르지 않습니다.");
          return;
        }
        setError(data.message || "탈퇴 처리 중 오류가 발생했습니다.");
        return;
      }

      // ── 성공 ──
      setDone(true);

      // 3초 후 로그아웃 + 랜딩 페이지 이동
      setTimeout(() => {
        try {
          userLogout();
        } catch (_) {}
        // ✅ Phase 9: localStorage.clear() → storage.clearUserData() + 인증 키 개별 삭제
        try {
          storage.clearUserData();
          // 인증 관련 글로벌 키도 삭제 (userLogout에서 처리하지만 안전장치)
          storage.removeRaw("user_id_token");
          storage.removeRaw("user_access_token");
          storage.removeRaw("user_refresh_token");
          storage.removeRaw("user_login_method");
        } catch (_) {}
        window.location.replace("/public/landing");
      }, 3000);
    } catch (err) {
      console.error("탈퇴 요청 실패:", err);
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  // ── 버튼 활성화 조건 ──
  const canNext =
    (step === 1 && reason !== "") ||
    (step === 2 && confirmInput === CONFIRM_TEXT);

  const canSubmit = step === 3 && password.length >= 1;

  // ── 로딩 중 ──
  if (checkingSubscription) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className={styles.pageTitle}>회원 탈퇴</h1>
          </div>
        </main>
        <BottomTab />
      </div>
    );
  }

  // ── 탈퇴 완료 화면 ──
  if (done) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.topBar}>
            <h1 className={styles.pageTitle} style={{ marginLeft: 8 }}>회원 탈퇴</h1>
          </div>

          <div className={styles.successCard}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>탈퇴 요청이 완료되었습니다</h2>
            <p className={styles.successDesc}>
              30일간의 유예 기간이 시작됩니다.<br />
              유예 기간 내 재로그인하시면 탈퇴가 취소됩니다.<br />
              잠시 후 메인 페이지로 이동합니다.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── 구독 차단 화면 ──
  if (blocked) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className={styles.pageTitle}>회원 탈퇴</h1>
          </div>

          <div className={styles.blockedCard}>
            <div className={styles.blockedIcon}>⚠️</div>
            <h2 className={styles.blockedTitle}>구독 해지 후 탈퇴해 주세요</h2>
            <p className={styles.blockedDesc}>
              현재 이용 중인 구독이 있습니다.<br />
              구독을 먼저 해지한 후 탈퇴를 진행해 주세요.
            </p>
            <button
              className={styles.blockedBtn}
              onClick={() => router.push("/mypage/settings/subscription")}
            >
              구독 관리로 이동
            </button>
          </div>
        </main>
        <BottomTab />
      </div>
    );
  }

  // ── 메인 탈퇴 플로우 ──
  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* ── 상단 바 ── */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()} aria-label="뒤로가기">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>회원 탈퇴</h1>
        </div>

        {/* ── 스텝 인디케이터 ── */}
        <div className={styles.stepIndicator}>
          <div className={`${styles.stepDot} ${step === 1 ? styles.stepDotActive : step > 1 ? styles.stepDotDone : ""}`}>1</div>
          <div className={`${styles.stepLine} ${step > 1 ? styles.stepLineActive : ""}`} />
          <div className={`${styles.stepDot} ${step === 2 ? styles.stepDotActive : step > 2 ? styles.stepDotDone : ""}`}>2</div>
          <div className={`${styles.stepLine} ${step > 2 ? styles.stepLineActive : ""}`} />
          <div className={`${styles.stepDot} ${step === 3 ? styles.stepDotActive : ""}`}>3</div>
        </div>

        {/* ── Step 1: 탈퇴 사유 선택 ── */}
        {step === 1 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>탈퇴 사유를 선택해 주세요</h2>
            <p className={styles.cardDesc}>
              서비스 개선을 위해 탈퇴 사유를 알려주세요.
            </p>
            <div className={styles.reasonList}>
              {REASONS.map((r) => (
                <button
                  key={r}
                  className={`${styles.reasonOption} ${reason === r ? styles.reasonOptionSelected : ""}`}
                  onClick={() => setReason(r)}
                >
                  <span className={`${styles.reasonRadio} ${reason === r ? styles.reasonRadioChecked : ""}`}>
                    {reason === r && <span className={styles.reasonRadioInner} />}
                  </span>
                  {r}
                </button>
              ))}
            </div>

            <button
              className={styles.nextBtn}
              disabled={!canNext}
              onClick={handleNext}
            >
              다음
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => router.back()}
            >
              취소
            </button>
          </div>
        )}

        {/* ── Step 2: "탈퇴합니다" 입력 ── */}
        {step === 2 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>탈퇴 확인</h2>
            <p className={styles.cardDesc}>
              탈퇴를 확인하려면 아래에 <strong>&ldquo;{CONFIRM_TEXT}&rdquo;</strong>를 정확히 입력해 주세요.
            </p>
            <input
              type="text"
              className={styles.confirmInput}
              placeholder={CONFIRM_TEXT}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
            />
            {confirmInput.length > 0 && (
              confirmInput === CONFIRM_TEXT ? (
                <p className={styles.confirmMatch}>✓ 일치합니다</p>
              ) : (
                <p className={styles.confirmMismatch}>텍스트가 일치하지 않습니다</p>
              )
            )}

            <button
              className={styles.nextBtn}
              disabled={!canNext}
              onClick={handleNext}
            >
              다음
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => setStep(1)}
            >
              이전
            </button>
          </div>
        )}

        {/* ── Step 3: 비밀번호 입력 ── */}
        {step === 3 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>비밀번호 확인</h2>
            <p className={styles.cardDesc}>
              본인 확인을 위해 현재 비밀번호를 입력해 주세요.
            </p>
            <input
              type="password"
              className={styles.passwordInput}
              placeholder="현재 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && <p className={styles.errorText}>{error}</p>}

            <button
              className={styles.nextBtn}
              disabled={!canSubmit || loading}
              onClick={handleWithdraw}
            >
              {loading ? "처리 중..." : "탈퇴하기"}
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => setStep(2)}
              disabled={loading}
            >
              이전
            </button>

            <div className={styles.infoBox}>
              <p className={styles.infoBoxText}>
                • 탈퇴 요청 후 30일간 유예 기간이 적용됩니다.<br />
                • 유예 기간 내 재로그인하시면 탈퇴가 자동 취소됩니다.<br />
                • 30일 후 개인정보가 영구 삭제되며 복구할 수 없습니다.<br />
                • 결제 기록은 법적 의무에 따라 5년간 익명 보관됩니다.
              </p>
            </div>
          </div>
        )}
      </main>

      <div style={{ height: 80 }} />
      <BottomTab />
    </div>
  );
}
