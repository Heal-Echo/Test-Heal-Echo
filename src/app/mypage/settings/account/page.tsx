// src/app/mypage/settings/account/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";
import Header from "@/components/Header";
import BottomTab from "@/components/BottomTab";
import {
  isUserLoggedIn,
  getUserInfo,
  getUserName,
  updateUserName,
  updateUserEmail,
  verifyUserEmail,
  changeUserPassword,
} from "@/auth/user";
// ✅ Phase 9: storage 추상화 레이어
import * as storage from "@/lib/storage";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [loginMethod, setLoginMethod] = useState<string>("");

  // 편집 모드
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // 이메일 변경
  const [emailStep, setEmailStep] = useState<"view" | "enterEmail" | "enterCode">("view");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");

  // 비밀번호 변경
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // 로딩 상태
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.replace("/public/login");
      return;
    }
    const info = getUserInfo();
    setEmail(info?.email || "");
    const userName = getUserName();
    setName(userName || "");
    // 로그인 방식 확인
    try {
      const method = storage.getRaw("user_login_method") || "email";
      setLoginMethod(method);
    } catch {
      setLoginMethod("email");
    }
  }, [router]);

  // ── 이름 변경 ──
  function handleNameEdit() {
    setNewName(name);
    setEditingName(true);
  }

  async function handleNameSave() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setNameSaving(true);
    setNameError("");

    try {
      await updateUserName(trimmed);
      setName(trimmed);
      setEditingName(false);
    } catch (err: any) {
      const msg =
        err?.message || "이름 변경에 실패했습니다. 다시 시도해 주세요.";
      setNameError(msg);
    } finally {
      setNameSaving(false);
    }
  }

  // ── 이메일 변경 ──
  function handleEmailEditStart() {
    setNewEmail("");
    setEmailCode("");
    setEmailError("");
    setEmailStep("enterEmail");
  }

  function handleEmailCancel() {
    setEmailStep("view");
    setNewEmail("");
    setEmailCode("");
    setEmailError("");
  }

  async function handleEmailSubmit() {
    if (!newEmail.includes("@")) {
      setEmailError("올바른 이메일 형식을 입력해 주세요.");
      return;
    }
    if (newEmail === email) {
      setEmailError("현재 이메일과 동일합니다.");
      return;
    }

    setEmailSaving(true);
    setEmailError("");

    try {
      await updateUserEmail(newEmail);
      // Cognito가 새 이메일로 인증 코드 자동 발송
      setEmailStep("enterCode");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "AliasExistsException") {
        setEmailError("이미 사용 중인 이메일입니다.");
      } else {
        setEmailError(err?.message || "이메일 변경에 실패했습니다.");
      }
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleEmailVerify() {
    if (emailCode.length < 4) {
      setEmailError("인증 코드를 입력해 주세요.");
      return;
    }

    setEmailSaving(true);
    setEmailError("");

    try {
      await verifyUserEmail(emailCode);
      setEmail(newEmail);
      setEmailStep("view");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "CodeMismatchException") {
        setEmailError("인증 코드가 올바르지 않습니다.");
      } else if (code === "ExpiredCodeException") {
        setEmailError("인증 코드가 만료되었습니다. 다시 시도해 주세요.");
      } else {
        setEmailError(err?.message || "인증에 실패했습니다.");
      }
    } finally {
      setEmailSaving(false);
    }
  }

  // ── 비밀번호 변경 ──
  async function handlePasswordSave() {
    if (!currentPassword) {
      setPasswordError("현재 비밀번호를 입력해 주세요.");
      return;
    }
    if (passwordNew.length < 8) {
      setPasswordError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (passwordNew !== passwordConfirm) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      await changeUserPassword(currentPassword, passwordNew);
      setPasswordSuccess("비밀번호가 변경되었습니다.");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setPasswordNew("");
      setPasswordConfirm("");
      // 3초 후 성공 메시지 제거
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "NotAuthorizedException") {
        setPasswordError("현재 비밀번호가 올바르지 않습니다.");
      } else if (code === "InvalidPasswordException") {
        setPasswordError(
          "새 비밀번호가 요구 조건을 충족하지 않습니다. (대소문자, 숫자, 특수문자 포함 8자 이상)"
        );
      } else if (code === "LimitExceededException") {
        setPasswordError("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setPasswordError(
          err?.message || "비밀번호 변경에 실패했습니다. 다시 시도해 주세요."
        );
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  // 이니셜 아바타
  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* ── 뒤로가기 + 타이틀 ── */}
        <div className={styles.topBar}>
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className={styles.pageTitle}>계정 관리</h1>
          <div className={styles.topBarSpacer} />
        </div>

        {/* ── 프로필 카드 ── */}
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            <span className={styles.avatarInitial}>{initial}</span>
          </div>

          {/* 이름 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>이름</div>
            {editingName ? (
              <div className={styles.verifyBlock}>
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    disabled={nameSaving}
                  />
                  <button
                    className={styles.saveBtn}
                    onClick={handleNameSave}
                    disabled={nameSaving}
                  >
                    {nameSaving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => {
                      setEditingName(false);
                      setNameError("");
                    }}
                    disabled={nameSaving}
                  >
                    취소
                  </button>
                </div>
                {nameError && (
                  <p className={styles.errorText}>{nameError}</p>
                )}
              </div>
            ) : (
              <div className={styles.infoValueRow}>
                <span className={styles.infoValue}>{name || "—"}</span>
                <button className={styles.editBtn} onClick={handleNameEdit}>
                  편집
                </button>
              </div>
            )}
          </div>

          {/* 이메일 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>이메일</div>
            {emailStep === "view" && (
              <div className={styles.infoValueRow}>
                <span className={styles.infoValue}>{email || "—"}</span>
                <button className={styles.editBtn} onClick={handleEmailEditStart}>
                  편집
                </button>
              </div>
            )}

            {emailStep === "enterEmail" && (
              <div className={styles.verifyBlock}>
                <p className={styles.verifyText}>
                  새로운 이메일 주소를 입력해 주세요.
                </p>
                <input
                  className={styles.editInput}
                  type="email"
                  placeholder="새 이메일 주소"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoFocus
                  disabled={emailSaving}
                />
                {emailError && (
                  <p className={styles.errorText}>{emailError}</p>
                )}
                <div className={styles.verifyActions}>
                  <button
                    className={styles.saveBtn}
                    onClick={handleEmailSubmit}
                    disabled={emailSaving}
                  >
                    {emailSaving ? "발송 중..." : "인증 코드 발송"}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={handleEmailCancel}
                    disabled={emailSaving}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {emailStep === "enterCode" && (
              <div className={styles.verifyBlock}>
                <p className={styles.verifyText}>
                  {newEmail}로 발송된 인증 코드를 입력해 주세요.
                </p>
                <input
                  className={styles.editInput}
                  placeholder="인증 코드"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  autoFocus
                  disabled={emailSaving}
                />
                {emailError && (
                  <p className={styles.errorText}>{emailError}</p>
                )}
                <div className={styles.verifyActions}>
                  <button
                    className={styles.saveBtn}
                    onClick={handleEmailVerify}
                    disabled={emailSaving}
                  >
                    {emailSaving ? "확인 중..." : "확인"}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={handleEmailCancel}
                    disabled={emailSaving}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 연결된 계정 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>로그인 방식</div>
            <div className={styles.infoValueRow}>
              <span className={styles.infoValue}>
                {loginMethod === "kakao" ? "카카오 로그인" : "이메일 로그인"}
              </span>
            </div>
          </div>
        </div>

        {/* ── 계정 보안 ── */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>계정 보안</h2>

          {/* 비밀번호 변경 */}
          {loginMethod !== "kakao" && (
            <div className={styles.securityRow}>
              <div className={styles.securityInfo}>
                <span className={styles.securityLabel}>비밀번호</span>
                <span className={styles.securityDesc}>••••••••</span>
              </div>
              <button
                className={styles.editBtn}
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                변경
              </button>
            </div>
          )}

          {showPasswordChange && loginMethod !== "kakao" && (
            <div className={styles.passwordForm}>
              <input
                className={styles.editInput}
                type="password"
                placeholder="현재 비밀번호"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={passwordSaving}
              />
              <input
                className={styles.editInput}
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
                value={passwordNew}
                onChange={(e) => setPasswordNew(e.target.value)}
                disabled={passwordSaving}
              />
              <input
                className={styles.editInput}
                type="password"
                placeholder="새 비밀번호 확인"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={passwordSaving}
              />
              {passwordError && (
                <p className={styles.errorText}>{passwordError}</p>
              )}
              <div className={styles.verifyActions}>
                <button
                  className={styles.saveBtn}
                  onClick={handlePasswordSave}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "변경 중..." : "비밀번호 변경"}
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordError("");
                  }}
                  disabled={passwordSaving}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {passwordSuccess && (
            <p className={styles.successText}>{passwordSuccess}</p>
          )}

          {loginMethod === "kakao" && (
            <div className={styles.securityRow}>
              <div className={styles.securityInfo}>
                <span className={styles.securityLabel}>비밀번호</span>
                <span className={styles.securityDesc}>
                  카카오 로그인 사용 중
                </span>
              </div>
            </div>
          )}

        </div>
      </main>

      <div className={styles.tabPadding} />
      <BottomTab />
    </div>
  );
}
