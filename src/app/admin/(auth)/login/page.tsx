"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./login.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          step: "init",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "로그인에 실패했습니다.");
        return;
      }

      // 로그인 성공 → middleware가 쿠키 감지하고 대시보드로 보냄
      router.replace("/admin/dashboard");
    } catch (err: any) {
      console.error(err);
      setErrorMessage("서버 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.mainContent}>
        <div className={styles.rightFrame}>
          <div className={styles.rightFrameContainer}>
            {/* 🔥 로고 (원형 + 텍스트 수정) */}
            <div className={styles.logoRow}>
              <Image
                src="/assets/images/Logo_HealEcho.png"
                alt="Heal Echo Logo"
                width={40}
                height={40}
                className={styles.logoImage} // ← 추가된 클래스
              />
              <span className={styles.logoText}>Heal Echo</span>
            </div>

            <form onSubmit={handleLogin} className={styles.emailLoginBox}>
              <input
                type="email"
                className={styles.emailInput}
                placeholder="관리자 이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                className={styles.emailInput}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

              <button type="submit" disabled={isLoading} className={styles.continueButton}>
                {isLoading ? "로그인 중..." : "관리자 로그인"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
