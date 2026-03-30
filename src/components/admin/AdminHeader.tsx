// src/components/admin/AdminHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();

  // 🔥 로그인 페이지에서는 헤더 자체가 렌더링되면 안 됨
  // /admin/login, /admin/(auth)/ 등에서는 헤더 숨기기
  if (pathname.startsWith("/admin/login")) {
    return null;
  }

  // 🔥 진짜 로그인 여부는 서버 쿠키 기반이지만
  // 헤더 렌더링은 단순히 UI 제어 목적
  const isLoggedIn = true;

  const handleLogout = async () => {
    try {
      // 1) 서버에 로그아웃 요청 → 쿠키 삭제
      await fetch("/api/admin/logout", { method: "POST" });

      // 2) SPA 내 히스토리 제거 (뒤로가기 차단)
      router.replace("/admin/login");

      // 3) BFCache 완전 무력화 (뒤로가기 눌러도 캐시된 화면 뜨지 않음)
      window.location.replace("/admin/login");
      // 혹은:
      // window.location.href = "/admin/login";

    } catch (e) {
      console.error("Logout error:", e);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        backdropFilter: "saturate(150%) blur(4px)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 16px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <Link
          href="/admin/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
          }}
        >
          <Image
            src="/assets/images/Logo_HealEcho.png"
            alt="Heal Echo 로고"
            width={40}
            height={40}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />

          <span
            style={{
              fontFamily: "PlayfairDisplay, serif",
              fontWeight: 900,
              fontSize: "18px",
              color: "#111",
            }}
          >
            Heal Echo
          </span>
        </Link>

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              fontWeight: 700,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "#fff",
              cursor: "pointer",
              color: "#111",
            }}
          >
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
