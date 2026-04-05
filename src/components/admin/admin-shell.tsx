// src/components/admin/AdminShell.tsx
"use client";

import { useState, useRef, ReactNode, useEffect } from "react";
import AdminSidebar from "./admin-sidebar";
import AdminHeader from "./admin-header";

/**
 * 🔧 AdminShell
 * - 오직 "레이아웃" 책임만 가진다.
 * - 인증/redirect 로직은 절대 넣지 않는다.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizing = useRef(false);

  const startResize = () => {
    isResizing.current = true;
  };

  // 전역 마우스 이벤트는 useEffect에서 한 번만 등록
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      let newWidth = e.clientX;
      if (newWidth < 160) newWidth = 160;
      if (newWidth > 420) newWidth = 420;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-black flex">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }}>
        <AdminSidebar />
      </div>

      {/* Sidebar Drag Handle */}
      <div
        onMouseDown={startResize}
        className="w-1 hover:bg-slate-400 cursor-col-resize bg-slate-300"
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col">
        <AdminHeader />

        <main style={{ marginLeft: "50px" }} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
