// src/app/admin/(auth)/layout.tsx
import type { ReactNode } from "react";
import "../../globals.css";

type AdminAuthLayoutProps = {
  children: ReactNode;
};

export default function AdminAuthLayout({ children }: AdminAuthLayoutProps) {
  // 로그인 전용 레이아웃: AdminShell 없이 children만 렌더링
  return <>{children}</>;
}
