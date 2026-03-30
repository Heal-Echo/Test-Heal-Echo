"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import styles from "./cancel.module.css";
import { isUserLoggedIn, getUserName } from "@/auth/user";
import { getSubscription } from "@/auth/subscription";
import type { UserSubscription } from "@/types/subscription";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

// ─────────────────────────────────────────
// 해지 사유 정의
// ─────────────────────────────────────────
type CancelReasonCode =
  | "too_expensive"
  | "no_time"
  | "not_effective"
  | "found_alternative"
  | "just_trying"
  | "other";

const CANCEL_REASONS: { code: CancelReasonCode; label: string }[] = [
  { code: "too_expensive", label: "가격이 부담돼요" },
  { code: "no_time", label: "바빠서 시간을 내기 어려워요" },
  { code: "not_effective", label: "기대했던 효과를 느끼지 못했어요." },
  { code: "found_alternative", label: "다른 서비스를 이용하기로 했어요." },
  { code: "just_trying", label: "무료 체험만 해보려고 했어요." },
  { code: "other", label: "기타" },
];

// 사유별 Step 2 피드백 질문 & placeholder
const FEEDBACK_CONFIG: Record<string, { question: string; placeholder: string }> = {
  too_expensive: {
    question: "힐에코에 어떤 서비스가 추가되면 가격 부담을 안 느끼실지 알려주세요.\u{1F60A}",
    placeholder: "예: 1:1 맞춤 코칭, 식단 관리 기능, 오프라인 클래스 등",
  },
  not_effective: {
    question: "힐에코에 어떤 서비스가 개선되면 더 좋은 효과를 느낄 수 있을지 알려주시면 적극 반영하겠습니다.",
    placeholder: "예: 더 다양한 난이도, 실시간 피드백, 체형별 맞춤 동작 등",
  },
  found_alternative: {
    question: "다른 서비스의 어떤 면이 힐에코와의 차별점으로 느끼셨나요?",
    placeholder: "예: 더 다양한 영상, 더 낮은 가격, 커뮤니티 기능 등",
  },
};

// 날짜 포맷
function formatDateKR(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

// ─────────────────────────────────────────
// 페이지 상태
// ─────────────────────────────────────────
type PageStep = "step1" | "step2" | "step3" | "processing" | "done" | "error";

export default function CancelPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [practiceDays, setPracticeDays] = useState(0);

  // 플로우 상태
  const [step, setStep] = useState<PageStep>("step1");
  const [selectedReason, setSelectedReason] = useState<CancelReasonCode | null>(null);
  const [otherText, setOtherText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }

    setUserName(getUserName() || "회원");

    (async () => {
      try {
        const sub = await getSubscription("autobalance");
        setSubscription(sub);
      } catch {}
    })();

    // 실천일 수 조회
    (async () => {
      try {
        const userToken = storage.getRaw("user_id_token");
        const res = await fetch("/api/user/practice-record", {
          method: "GET",
          cache: "no-store",
          headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const items: { type: string; date: string }[] = data.items || [];
          const allDates = new Set(items.map((i) => i.date));
          setPracticeDays(allDates.size);
        }
      } catch {}
    })();
  }, [router]);

  // ─── Step 1 → Step 2 이동 가능 여부 ───
  const canProceedStep1 =
    selectedReason !== null &&
    (selectedReason !== "other" || otherText.trim().length > 0);

  // ─── Step 2: 피드백 입력이 필요한 사유인지 ───
  const needsFeedback = selectedReason !== null && FEEDBACK_CONFIG[selectedReason] !== undefined;

  // Step 2 → Step 3 이동 가능 여부 (피드백 필요 시 필수 입력)
  const canProceedStep2 = !needsFeedback || feedbackText.trim().length > 0;

  // ─── 해지 실행 ───
  async function handleCancel() {
    setStep("processing");

    try {
      const userToken = storage.getRaw("user_id_token");
      const res = await fetch("/api/user/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        },
        body: JSON.stringify({
          programId: "autobalance",
          cancelReason: selectedReason,
          cancelFeedback:
            selectedReason === "other"
              ? otherText.trim()
              : feedbackText.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || "해지 처리 중 오류가 발생했습니다.");
        setStep("error");
        return;
      }

      setStep("done");
    } catch (err) {
      console.error("[Cancel] Error:", err);
      setErrorMessage("해지 처리 중 오류가 발생했습니다.");
      setStep("error");
    }
  }

  // ─── 체험 종료일 ───
  const trialEndDateStr = subscription?.trialEndDate
    ? formatDateKR(subscription.trialEndDate)
    : "-";

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* 상단 네비 */}
        <div className={styles.topBar}>
          <button
            className={styles.backBtn}
            onClick={() => {
              if (step === "step2") setStep("step1");
              else if (step === "step3") setStep("step2");
              else router.back();
            }}
            aria-label="뒤로가기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>체험 해지</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* ══ Step 1: 해지 사유 선택 ══ */}
        {step === "step1" && (
          <section className={styles.step1Section}>
            <h2 className={styles.stepTitle}>어떤 부분이 아쉬웠나요?</h2>
            <p className={styles.stepSub}>솔직한 의견이 힐에코를 더 나은 서비스로 만듭니다.</p>

            <div className={styles.reasonList}>
              {CANCEL_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.code;
                return (
                  <div key={reason.code}>
                    <div
                      className={`${styles.reasonItem} ${isSelected ? styles.reasonItemSelected : ""}`}
                      onClick={() => {
                        setSelectedReason(reason.code);
                        setFeedbackText("");
                      }}
                    >
                      <div className={`${styles.reasonRadio} ${isSelected ? styles.reasonRadioSelected : ""}`}>
                        {isSelected && <div className={styles.reasonRadioDot} />}
                      </div>
                      <span className={styles.reasonText}>{reason.label}</span>
                    </div>

                    {/* 기타 선택 시 자유 입력 */}
                    {reason.code === "other" && isSelected && (
                      <textarea
                        className={styles.otherInput}
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="아쉬웠던 점을 자유롭게 적어주세요."
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className={styles.nextBtn}
              disabled={!canProceedStep1}
              onClick={() => setStep("step2")}
            >
              다음
            </button>
          </section>
        )}

        {/* ══ Step 2: 사유별 맞춤 화면 ══ */}
        {step === "step2" && selectedReason && (
          <section className={styles.step2Section}>

            {/* ── too_expensive: 가격이 부담돼요 ── */}
            {selectedReason === "too_expensive" && (
              <>
                <p className={styles.step2TopMsg}>고객의 의견을 적극 반영하겠습니다.</p>
                <p className={styles.step2Question}>{FEEDBACK_CONFIG.too_expensive.question}</p>
                <textarea
                  className={styles.feedbackInput}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={FEEDBACK_CONFIG.too_expensive.placeholder}
                />
              </>
            )}

            {/* ── no_time: 바빠서 시간을 내기 어려워요 ── */}
            {selectedReason === "no_time" && (
              <>
                <p className={styles.step2TopMsg}>하루 15분, 잠들기 전에 시작할 수 있어요.</p>
                <div className={styles.messageCard}>
                  <p className={styles.messageCardText}>
                    작은 습관이 {userName}님의 1년을 바꿀 수 있습니다.
                  </p>
                  {practiceDays > 0 && (
                    <p className={styles.messageCardData}>
                      {userName}님은 지금까지 {practiceDays}일 실천하셨어요.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── not_effective: 기대했던 효과를 느끼지 못했어요 ── */}
            {selectedReason === "not_effective" && (
              <>
                <p className={styles.step2TopMsg}>
                  {practiceDays > 0
                    ? `${userName}님은 지금까지 ${practiceDays}일 실천하셨어요.`
                    : "아직 솔루션을 경험하지 못하셨어요."}
                </p>
                <p className={styles.step2Question}>{FEEDBACK_CONFIG.not_effective.question}</p>
                <textarea
                  className={styles.feedbackInput}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={FEEDBACK_CONFIG.not_effective.placeholder}
                />
              </>
            )}

            {/* ── found_alternative: 다른 서비스를 이용하기로 했어요 ── */}
            {selectedReason === "found_alternative" && (
              <>
                <p className={styles.step2TopMsg}>고객의 의견을 적극 반영하겠습니다.</p>
                <p className={styles.step2Question}>{FEEDBACK_CONFIG.found_alternative.question}</p>
                <textarea
                  className={styles.feedbackInput}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={FEEDBACK_CONFIG.found_alternative.placeholder}
                />
              </>
            )}

            {/* ── just_trying: 무료 체험만 해보려고 했어요 ── */}
            {selectedReason === "just_trying" && (
              <>
                {practiceDays > 0 ? (
                  <div className={styles.lossCard}>
                    <p className={styles.lossTitle}>해지하면 더 이상 이용할 수 없어요</p>
                    <div className={styles.lossList}>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>📅</span>
                        <span>{practiceDays}일의 실천 기록</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🌿</span>
                        <span>자율신경 밸런스 추이 데이터</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🌙</span>
                        <span>수면 품질 분석 리포트</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🧘</span>
                        <span>2주차 맞춤 솔루션</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🎁</span>
                        <span>4주 실천 선물 영상</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.lossCard}>
                    <p className={styles.lossEmpty}>
                      아직 경험하지 못한 솔루션이 기다리고 있어요.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── other: 기타 ── */}
            {selectedReason === "other" && (
              <>
                <p className={styles.step2TopMsg}>소중한 의견 감사합니다.</p>
                {practiceDays > 0 ? (
                  <div className={styles.lossCard}>
                    <p className={styles.lossTitle}>해지하면 더 이상 이용할 수 없어요</p>
                    <div className={styles.lossList}>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>📅</span>
                        <span>{practiceDays}일의 실천 기록</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🌿</span>
                        <span>자율신경 밸런스 추이 데이터</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🌙</span>
                        <span>수면 품질 분석 리포트</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🧘</span>
                        <span>2주차 맞춤 솔루션</span>
                      </div>
                      <div className={styles.lossItem}>
                        <span className={styles.lossIcon}>🎁</span>
                        <span>4주 실천 선물 영상</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.lossCard}>
                    <p className={styles.lossEmpty}>
                      아직 경험하지 못한 솔루션이 기다리고 있어요.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* CTA */}
            <div className={styles.step2Cta}>
              <button
                className={styles.primaryBtn}
                onClick={() => router.push("/mypage/settings/subscription")}
              >
                {selectedReason === "just_trying" ? "한 번만 더 경험해보기" : "체험 계속하기"}
              </button>
              <button
                className={styles.secondaryBtn}
                disabled={!canProceedStep2}
                onClick={() => {
                  setConfirmed(false);
                  setStep("step3");
                }}
              >
                그래도 해지할게요
              </button>
            </div>
          </section>
        )}

        {/* ══ Step 3: 최종 확인 ══ */}
        {step === "step3" && (
          <section className={styles.step3Section}>
            <div className={styles.confirmBox}>
              <p className={styles.confirmText}>
                체험을 해지하면 <strong>{trialEndDateStr}</strong>까지 모든 콘텐츠를 이용할 수 있으며, 이후 자동 결제가 취소됩니다.
              </p>
            </div>

            <div className={styles.checkboxRow} onClick={() => setConfirmed(!confirmed)}>
              <div className={`${styles.checkbox} ${confirmed ? styles.checkboxChecked : ""}`}>
                {confirmed && <span className={styles.checkboxMark}>✓</span>}
              </div>
              <span className={styles.checkboxLabel}>위 내용을 확인했습니다</span>
            </div>

            <div className={styles.step3Cta}>
              <button
                className={styles.primaryBtn}
                onClick={() => router.push("/mypage/settings/subscription")}
              >
                체험 계속하기
              </button>
              <button
                className={styles.dangerBtn}
                disabled={!confirmed}
                onClick={handleCancel}
              >
                해지 완료
              </button>
            </div>
          </section>
        )}

        {/* ══ 처리 중 ══ */}
        {step === "processing" && (
          <section className={styles.statusSection}>
            <div className={styles.spinner} />
            <h2 className={styles.statusTitle}>해지 처리 중...</h2>
            <p className={styles.statusDesc}>잠시만 기다려주세요.</p>
          </section>
        )}

        {/* ══ 해지 완료 ══ */}
        {step === "done" && (
          <section className={styles.statusSection}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.statusTitle}>체험이 해지되었습니다</h2>
            <p className={styles.statusDesc}>
              {trialEndDateStr}까지 모든 콘텐츠를 이용하실 수 있어요.
            </p>
            <p className={styles.statusSub}>언제든 다시 시작할 수 있습니다.</p>
            <div className={styles.statusCta}>
              <button
                className={styles.statusBtn}
                onClick={() => router.push("/wellness/solution")}
              >
                솔루션 페이지로 돌아가기
              </button>
            </div>
          </section>
        )}

        {/* ══ 오류 ══ */}
        {step === "error" && (
          <section className={styles.statusSection}>
            <div className={styles.errorIcon}>!</div>
            <h2 className={styles.statusTitle}>해지 처리 실패</h2>
            <p className={styles.statusDesc}>{errorMessage}</p>
            <button
              className={styles.retryBtn}
              onClick={() => setStep("step3")}
            >
              다시 시도
            </button>
          </section>
        )}
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
