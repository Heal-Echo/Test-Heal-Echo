// src/app/admin/(shell)/layout.tsx

// ❗ 서버 컴포넌트로 선언 (use client 제거)
// 관리자 페이지는 절대 캐싱되면 안 되므로 dynamic 설정
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import "../../globals.css";

type AdminShellLayoutProps = {
  children: ReactNode;
};

export default function AdminShellLayout({ children }: AdminShellLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}
