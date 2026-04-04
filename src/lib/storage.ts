// src/lib/storage.ts
// =======================================================
// 스토리지 추상화 레이어
// - 현재: localStorage + sessionStorage 기반 (웹)
// - 향후: AsyncStorage 등으로 교체 가능 (앱)
// - 모든 사용자 데이터 키에 userId를 자동 포함하여 계정별 격리
// - sessionStorage 추상화: 앱 전환 시 내부 구현만 교체
// - 키 레지스트리: 동적 키를 목록으로 관리하여 앱 전환 호환성 확보
// =======================================================

// SSR 방지
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// =======================================================
// 1) 기본 저장소 접근 (raw — userId 접두사 없음)
//    인증 토큰 등 공통 키에 사용
// =======================================================

/** localStorage에서 값을 읽습니다 (키 그대로 사용) */
export function getRaw(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorage에 값을 저장합니다 (키 그대로 사용) */
export function setRaw(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** localStorage에서 값을 삭제합니다 (키 그대로 사용) */
export function removeRaw(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

// =======================================================
// 2) 현재 로그인된 사용자 ID 추출
//    JWT ID Token의 sub 클레임에서 추출
// =======================================================

/**
 * 현재 로그인된 사용자의 ID(sub)를 반환합니다.
 * - JWT ID Token의 sub 클레임에서 추출
 * - 토큰이 없거나 파싱 실패 시 null 반환
 */
export function getUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    const token = getRaw("user_id_token");
    if (!token) return null;

    const payload = token.split(".")[1];
    if (!payload) return null;

    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes));

    return decoded.sub || null;
  } catch {
    return null;
  }
}

// =======================================================
// 3) 사용자별 키 생성
//    key → key__{userId} 형태로 변환하여 계정별 격리
// =======================================================

/**
 * 키에 현재 사용자 ID를 접미사로 추가합니다.
 * - 예: userKey("selfcheck_result") → "selfcheck_result__abc123"
 * - userId를 추출할 수 없으면 원래 키를 그대로 반환 (로그아웃 상태 안전장치)
 */
export function userKey(key: string): string {
  const uid = getUserId();
  if (!uid) return key;
  return `${key}__${uid}`;
}

// =======================================================
// 4) 동적 키 레지스트리
//    - 날짜별/프로그램별로 생성되는 키를 등록 목록으로 관리
//    - clearUserData()에서 localStorage 직접 열거 대신 이 목록 참조
//    - 향후 AsyncStorage 전환 시에도 동일하게 작동
//    - 레지스트리 키 자체도 userId로 격리
// =======================================================

/** 동적 키로 판별할 접두사 목록 */
const DYNAMIC_KEY_PREFIXES = [
  "weekly_habit_sleep_log_",
  "balance_video_played_",
  "play_attempted_",
];

/** 동적 키 레지스트리의 저장 키 이름 */
const DYNAMIC_REGISTRY_KEY = "__dynamic_keys_registry";

/**
 * 키가 동적 키 접두사에 해당하는지 확인합니다.
 * - "weekly_habit_sleep_log_2026-03-01" → true
 * - "profile_setup_done" → false
 */
function isDynamicKey(key: string): boolean {
  return DYNAMIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * 동적 키를 레지스트리에 등록합니다.
 * - rawKey: 실제 localStorage에 저장된 키 (userId 접미사 포함)
 * - 중복 등록 방지
 */
function trackDynamicKey(rawKey: string): void {
  try {
    const uid = getUserId();
    const registryKey = uid ? `${DYNAMIC_REGISTRY_KEY}__${uid}` : DYNAMIC_REGISTRY_KEY;
    const existing = getRaw(registryKey);
    const keys: string[] = existing ? JSON.parse(existing) : [];
    if (!keys.includes(rawKey)) {
      keys.push(rawKey);
      setRaw(registryKey, JSON.stringify(keys));
    }
  } catch {}
}

/**
 * 레지스트리에 등록된 동적 키 목록을 반환합니다.
 * - clearUserData()에서 사용
 */
function getTrackedDynamicKeys(): string[] {
  try {
    const uid = getUserId();
    const registryKey = uid ? `${DYNAMIC_REGISTRY_KEY}__${uid}` : DYNAMIC_REGISTRY_KEY;
    const existing = getRaw(registryKey);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

/**
 * 동적 키 레지스트리에서 특정 접두사에 해당하는 키 목록을 반환합니다.
 * - localStorage 직접 열거 없이 레지스트리를 참조
 * - 반환되는 키는 실제 localStorage에 저장된 rawKey (userId 접미사 포함)
 * - 향후 AsyncStorage 등에서도 동일하게 작동
 *
 * @param prefix - 필터링할 키 접두사 (예: "weekly_habit_sleep_log_")
 * @returns rawKey 배열 (예: ["weekly_habit_sleep_log_2026-03-01__abc123"])
 */
export function getKeysByPrefix(prefix: string): string[] {
  const allKeys = getTrackedDynamicKeys();
  return allKeys.filter((rawKey) => {
    // rawKey에서 userId 접미사를 제거하고 기본 키로 비교
    const uid = getUserId();
    const baseKey = uid ? rawKey.replace(`__${uid}`, "") : rawKey;
    return baseKey.startsWith(prefix);
  });
}

/**
 * 동적 키 레지스트리에서 특정 접두사에 해당하는 키-값 쌍을 반환합니다.
 * - getKeysByPrefix()의 확장: 값도 함께 읽어서 반환
 * - localStorage 직접 열거 없이 레지스트리를 참조
 *
 * @param prefix - 필터링할 키 접두사 (예: "weekly_habit_sleep_log_")
 * @returns { rawKey, baseKey, value } 배열
 */
export function getEntriesByPrefix(
  prefix: string
): { rawKey: string; baseKey: string; value: string | null }[] {
  const keys = getKeysByPrefix(prefix);
  const uid = getUserId();
  return keys.map((rawKey) => ({
    rawKey,
    baseKey: uid ? rawKey.replace(`__${uid}`, "") : rawKey,
    value: getRaw(rawKey),
  }));
}

/**
 * 동적 키 레지스트리 자체를 삭제합니다.
 * - clearUserData() 완료 후 호출
 */
function clearDynamicKeyRegistry(): void {
  try {
    const uid = getUserId();
    if (uid) {
      removeRaw(`${DYNAMIC_REGISTRY_KEY}__${uid}`);
    }
    removeRaw(DYNAMIC_REGISTRY_KEY);
  } catch {}
}

// =======================================================
// 5) Cognito 키 레지스트리
//    - Cognito SDK가 생성하는 키를 등록 목록으로 관리
//    - cognitoStorageAdapter.clear()에서 사용
// =======================================================

const COGNITO_REGISTRY_KEY = "__cognito_keys_registry";

/** Cognito 키를 레지스트리에 등록합니다 */
function trackCognitoKey(key: string): void {
  try {
    const existing = getRaw(COGNITO_REGISTRY_KEY);
    const keys: string[] = existing ? JSON.parse(existing) : [];
    if (!keys.includes(key)) {
      keys.push(key);
      setRaw(COGNITO_REGISTRY_KEY, JSON.stringify(keys));
    }
  } catch {}
}

/** Cognito 레지스트리에 등록된 키 목록을 반환합니다 */
function getTrackedCognitoKeys(): string[] {
  try {
    const existing = getRaw(COGNITO_REGISTRY_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

/** Cognito 키 레지스트리 자체를 삭제합니다 */
function clearCognitoKeyRegistry(): void {
  try {
    removeRaw(COGNITO_REGISTRY_KEY);
  } catch {}
}

// =======================================================
// 6) 사용자별 저장소 접근 (키에 userId 자동 포함)
//    사용자 데이터(자가체크, 프로필 등)에 사용
//    동적 키 접두사에 해당하면 자동으로 레지스트리에 등록
// =======================================================

/** 현재 사용자의 데이터를 읽습니다 (키에 userId 자동 포함) */
export function get(key: string): string | null {
  return getRaw(userKey(key));
}

/** 현재 사용자의 데이터를 저장합니다 (키에 userId 자동 포함) */
export function set(key: string, value: string): void {
  const rawKey = userKey(key);
  setRaw(rawKey, value);
  // 동적 키이면 레지스트리에 자동 등록
  if (isDynamicKey(key)) {
    trackDynamicKey(rawKey);
  }
}

/** 현재 사용자의 데이터를 삭제합니다 (키에 userId 자동 포함) */
export function remove(key: string): void {
  removeRaw(userKey(key));
}

// =======================================================
// 7) JSON 편의 함수
// =======================================================

/** JSON 객체를 읽습니다 (파싱 실패 시 null) */
export function getJSON<T = unknown>(key: string): T | null {
  const raw = get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** JSON 객체를 저장합니다 */
export function setJSON(key: string, value: unknown): void {
  set(key, JSON.stringify(value));
}

// =======================================================
// 8) 사용자 데이터 일괄 삭제 (로그아웃 시 사용)
//    user.ts의 userLogout()에서 호출
//    동적 키는 레지스트리를 참조하여 삭제 (localStorage 직접 열거 제거)
// =======================================================

/** 로그아웃 시 호출: 현재 사용자의 데이터를 모두 삭제합니다 */
export function clearUserData(): void {
  if (!isBrowser()) return;

  // 고정 키 목록 (userId 접미사가 붙은 키와 기존 키 모두 삭제)
  const FIXED_KEYS = [
    // 자가체크
    "selfcheck_result",
    "selfcheck_done",
    "selfcheck_aws_pending",
    // 프로필
    "user_profile",
    "profile_setup_done",
    "profile_aws_pending",
    // PSQI
    "psqi_skipped",
    // 프로그램 선택 / 습관 트래커
    "weekly_habit_selected_program",
    "weekly_habit_program_confirmed",
    "weekly_habit_change_used",
    "weekly_habit_tracker_started",
    "weekly_habit_start_date",
    "weekly_habit_custom_items",
    "weekly_habit_psqi_popup_shown",
    "weekly_habit_last_seen_week",
    "weekly_habit_first_visit_done",
    // 마이그레이션 플래그
    "practice_records_migrated",
    "sleep_logs_migrated",
    // 구독/결제 캐시
    "balance_subscription_autobalance",
    "balance_watch_records_autobalance",
    "balance_gift_cycle_autobalance",
    // AWS pending 플래그
    "program_selection_aws_pending",
    "subscription_aws_pending",
    "subscription_pending_payload",
    "balance_watch_records_aws_pending_autobalance",
    "balance_gift_cycle_aws_pending_autobalance",
  ];

  const uid = getUserId();

  // 고정 키 삭제: userId가 붙은 키 + 기존 키(하위 호환)
  for (const key of FIXED_KEYS) {
    try {
      removeRaw(key);
      if (uid) removeRaw(`${key}__${uid}`);
    } catch {}
  }

  // 동적 키 삭제: 레지스트리에 등록된 키를 참조하여 삭제
  // (기존: localStorage.length/key(i) 직접 열거 → 앱 전환 시 호환 불가)
  // (변경: 키 레지스트리 참조 → AsyncStorage 등에서도 동일하게 작동)
  try {
    const dynamicKeys = getTrackedDynamicKeys();
    for (const rawKey of dynamicKeys) {
      removeRaw(rawKey);
    }
    clearDynamicKeyRegistry();
  } catch {}
}

// =======================================================
// 9) 기존 키 → 사용자별 키 마이그레이션
//    Phase 3 이후, 기존 localStorage 데이터를 userId 키로 이전
// =======================================================

/**
 * 기존 키(userId 없음)에 데이터가 있고
 * 사용자별 키(userId 있음)에 데이터가 없으면 이전합니다.
 * - Phase 3 이후 각 페이지에서 최초 1회 호출
 * - 이전 완료 후 기존 키는 삭제
 * - 동적 키이면 마이그레이션 시 레지스트리에도 등록
 */
export function migrateKey(key: string): void {
  if (!isBrowser()) return;
  const uid = getUserId();
  if (!uid) return;

  const newKey = `${key}__${uid}`;

  try {
    // 이미 사용자별 키에 데이터가 있으면 건너뜀
    if (getRaw(newKey) !== null) return;

    // 기존 키에 데이터가 있으면 이전
    const oldValue = getRaw(key);
    if (oldValue !== null) {
      setRaw(newKey, oldValue);
      removeRaw(key);
      // 동적 키이면 레지스트리에 등록
      if (isDynamicKey(key)) {
        trackDynamicKey(newKey);
      }
    }
  } catch {}
}

// =======================================================
// 10) 세션 저장소 접근 (sessionStorage 추상화)
//    - 현재: sessionStorage 기반 (웹) + 인메모리 Map fallback
//    - sessionStorage를 사용할 수 없는 환경(앱, SSR 등)에서는
//      인메모리 Map으로 자동 전환
//    - 용도: 리다이렉트 경로 저장, 로그아웃 출처 기록,
//            OAuth state 검증 등 세션 단위 임시 데이터
// =======================================================

/** sessionStorage 사용 불가 시 인메모리 fallback */
const sessionFallback = new Map<string, string>();

/** sessionStorage에서 값을 읽습니다 */
export function getSession(key: string): string | null {
  if (!isBrowser()) return sessionFallback.get(key) ?? null;
  try {
    return sessionStorage.getItem(key) ?? sessionFallback.get(key) ?? null;
  } catch {
    return sessionFallback.get(key) ?? null;
  }
}

/** sessionStorage에 값을 저장합니다 */
export function setSession(key: string, value: string): void {
  sessionFallback.set(key, value);
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

/** sessionStorage에서 값을 삭제합니다 */
export function removeSession(key: string): void {
  sessionFallback.delete(key);
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

/** sessionStorage를 전체 삭제합니다 (로그아웃 시 사용) */
export function clearSession(): void {
  sessionFallback.clear();
  if (!isBrowser()) return;
  try {
    sessionStorage.clear();
  } catch {}
}

// =======================================================
// 11) 쿠키 접근 추상화
//    - 현재: document.cookie 기반 (웹)
//    - 향후: 앱 전환 시 deep link 파라미터, URL scheme,
//            또는 React Native 브릿지로 교체 가능
//    - 용도: 소셜 로그인 서버 콜백 → 클라이언트 토큰 전달
// =======================================================

/** 쿠키에서 값을 읽습니다 */
export function getCookie(name: string): string | null {
  if (!isBrowser() || typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(^| )${name}=([^;]+)`)
    );
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/** 쿠키를 삭제합니다 (max-age=0 으로 만료 처리) */
export function deleteCookie(name: string): void {
  if (!isBrowser() || typeof document === "undefined") return;
  try {
    document.cookie = `${name}=; path=/; max-age=0`;
  } catch {}
}

// =======================================================
// 12) Cognito SDK 커스텀 Storage 어댑터
//     - amazon-cognito-identity-js의 ICognitoStorage 인터페이스 구현
//     - SDK 내부 localStorage 직접 접근을 추상화 레이어로 우회
//     - 향후 앱 전환 시 AsyncStorage 등으로 교체 가능
//     - 키: CognitoIdentityServiceProvider.{clientId}.{username}.*
//     - 키 레지스트리를 통해 clear() 시 localStorage 직접 열거 제거
// =======================================================

/**
 * Cognito SDK가 사용하는 Storage 인터페이스 구현체.
 * getRaw/setRaw/removeRaw를 통해 추상화 레이어를 경유합니다.
 * setItem 시 키를 레지스트리에 자동 등록하여 clear() 호환성 확보.
 */
export const cognitoStorageAdapter = {
  getItem(key: string): string | null {
    return getRaw(key);
  },

  setItem(key: string, value: string): void {
    setRaw(key, value);
    // Cognito 키를 레지스트리에 자동 등록
    trackCognitoKey(key);
  },

  removeItem(key: string): void {
    removeRaw(key);
  },

  clear(): void {
    // Cognito SDK는 clear()를 호출하지 않지만 인터페이스 충족용
    // 레지스트리에 등록된 Cognito 키만 정리 (localStorage 직접 열거 제거)
    if (!isBrowser()) return;
    try {
      const cognitoKeys = getTrackedCognitoKeys();
      for (const k of cognitoKeys) {
        removeRaw(k);
      }
      clearCognitoKeyRegistry();
    } catch {}
  },
};
