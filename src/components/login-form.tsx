// src/components/LoginForm.tsx
// 확인 방법:
// 1) 관리자 계정(username/password) 입력 후 로그인 시 Studio로 전환되는지 확인.
// 2) 잘못된 암호 시 에러 메시지 노출 확인.

"use client";

import React, { useState } from "react";
import { logout } from "@/auth/cognito";

type Props = {
  onLoggedIn: () => void;
};

export default function LoginForm({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 서버 로그인 API는 username/password를 JSON으로 받는다고 가정
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        // 서버가 { message: "..." } 형식으로 에러를 줄 수도 있고 아닐 수도 있으므로 방어적으로 처리
        let message = "로그인 실패";
        try {
          const data = await res.json();
          if (data && typeof data.message === "string") {
            message = data.message;
          }
        } catch (_) {
          // JSON 파싱 실패 시 기본 메시지 유지
        }
        setErr(message);
        return;
      }

      // 여기까지 왔다는 것은 서버에서 쿠키 설정까지 완료된 것
      onLoggedIn();
    } catch (e: any) {
      console.error("Admin login error:", e);
      setErr(e?.message ?? "로그인 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoutClick() {
    try {
      await logout();
      alert("로그아웃 완료");
    } catch (e) {
      console.error("Admin logout error:", e);
      alert("로그아웃 중 오류가 발생했지만, 대부분의 경우 세션은 정리되었습니다.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 space-y-3">
      <h2 className="text-xl font-bold">관리자 로그인</h2>

      <input
        className="block border p-2 w-full"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        className="block border p-2 w-full"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {err && <div className="text-red-600">{err}</div>}

      <button className="border px-4 py-2 w-full" disabled={busy}>
        {busy ? "로그인 중..." : "로그인"}
      </button>

      <button type="button" className="border px-4 py-2 w-full" onClick={handleLogoutClick}>
        로그아웃
      </button>
    </form>
  );
}
