// src/app/admin/layout.tsx
import type { ReactNode } from "react";

type AdminRootLayoutProps = {
  children: ReactNode;
};

export default function AdminRootLayout({ children }: AdminRootLayoutProps) {
  // 여기서는 아무 레이아웃도 적용하지 않고 그대로 children만 내려보냅니다.
  // 실제 AdminShell 적용은 (shell)/layout.tsx 에서 처리합니다.
  return <>{children}</>;
}
