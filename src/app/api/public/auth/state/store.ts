// src/app/api/public/auth/state/store.ts
// =======================================================
// OAuth CSRF state 서버 저장소 — 유틸 함수
// =======================================================
// route.ts(POST 핸들러)와 콜백 라우트에서 공유하는 함수만 분리.
// Next.js Route Handler 파일은 HTTP 메서드만 export 가능하므로,
// createOAuthState / verifyOAuthState는 이 파일에서 export합니다.

// ─── 서버 메모리 state 저장소 ───
// globalThis를 사용하여 Next.js 개발 모드에서 모듈 재컴파일 시에도
// state가 유지되도록 함 (HMR/라우트 재컴파일 대응)
interface StateEntry {
  provider: string;
  createdAt: number;
}

const GLOBAL_KEY = "__oauth_state_store__" as const;
const STATE_TTL_MS = 5 * 60 * 1000; // 5분

function getStateStore(): Map<string, StateEntry> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = new Map<string, StateEntry>();
  }
  return (globalThis as any)[GLOBAL_KEY];
}

const stateStore = getStateStore();

// 만료된 state 정리 (10분마다)
if (!(globalThis as any).__oauth_state_cleanup__) {
  (globalThis as any).__oauth_state_cleanup__ = setInterval(() => {
    const now = Date.now();
    const store = getStateStore();
    for (const [key, entry] of store) {
      if (now - entry.createdAt > STATE_TTL_MS) {
        store.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

// =======================================================
// state 생성 (클라이언트 auth 모듈에서 호출)
// =======================================================
export function createOAuthState(provider: string): string {
  const state = crypto.randomUUID();
  stateStore.set(state, {
    provider,
    createdAt: Date.now(),
  });
  return state;
}

// =======================================================
// state 검증 (서버 콜백에서 호출)
// =======================================================
// 성공 시 provider 문자열 반환, 실패 시 null
export function verifyOAuthState(state: string): string | null {
  const entry = stateStore.get(state);
  if (!entry) return null;

  // TTL 확인
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return null;
  }

  // 1회용: 검증 후 즉시 삭제
  stateStore.delete(state);
  return entry.provider;
}
