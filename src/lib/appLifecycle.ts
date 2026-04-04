// src/lib/appLifecycle.ts
// =======================================================
// 앱 라이프사이클 이벤트 추상화
// - 현재: 웹 브라우저 이벤트 (visibilitychange, online)
// - 향후: React Native AppState, NetInfo 등으로 교체 가능
// - 반환값: cleanup 함수 (useEffect에서 return으로 사용)
// =======================================================

/**
 * 앱이 백그라운드에서 포그라운드로 돌아올 때 콜백을 실행합니다.
 * - 웹: document.visibilitychange → visible 전환 시
 * - 향후 앱: AppState → active 전환 시
 *
 * @returns cleanup 함수 (useEffect 반환용)
 */
export function onAppResume(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  const handler = () => {
    if (document.visibilityState === "visible") {
      callback();
    }
  };

  document.addEventListener("visibilitychange", handler);

  return () => {
    document.removeEventListener("visibilitychange", handler);
  };
}

/**
 * 네트워크가 오프라인에서 온라인으로 복구될 때 콜백을 실행합니다.
 * - 웹: window.online 이벤트
 * - 향후 앱: NetInfo의 연결 상태 변경 시
 *
 * @returns cleanup 함수 (useEffect 반환용)
 */
export function onNetworkRestore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", callback);

  return () => {
    window.removeEventListener("online", callback);
  };
}
