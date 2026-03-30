# Storage Migration — Phase 9: 잔여 localStorage 완전 제거

## 궁극적 목적

Heal Echo 웹앱의 **모든 `localStorage` 직접 호출을 `src/lib/storage.ts` 추상화 레이어로 전환**하여:
1. **계정 간 데이터 오염 방지**: 사용자 데이터 키에 userId가 자동 포함되어 계정별 격리
2. **앱 연동 준비**: React Native에는 `localStorage`가 없으므로, `storage.ts` 내부 구현만 `AsyncStorage`로 교체하면 전체 앱이 동작하도록 보장
3. **단일 진입점 원칙**: 저장소 접근이 한 파일(`storage.ts`)로 집중되어 유지보수성 향상

## 지금까지 완료된 작업 (Phase 1~8)

### Phase 1 ✅ — 로그아웃 시 사용자 데이터 초기화
- `src/auth/user.ts`의 `userLogout()`에 사용자 데이터 삭제 추가

### Phase 2 ✅ — 스토리지 추상화 레이어 생성
- `src/lib/storage.ts` 신규 생성
- API: `get/set/remove` (userId 자동 포함), `getRaw/setRaw/removeRaw` (글로벌 키), `getJSON/setJSON`, `clearUserData()`, `migrateKey()`, `userKey()`

### Phase 3 ✅ — SelfCheckSurvey.tsx 전환
- `src/components/self-check/SelfCheckSurvey.tsx` → storage 레이어 + AWS 우선 조회

### Phase 4 ✅ — Profile 전환
- `src/app/home/profile-setup/page.tsx` → storage 레이어
- `src/app/home/page.tsx` → storage 레이어 + migrateKey

### Phase 5 ✅ — 프로그램 선택/시작일 (AWS 신규 + 프론트 전환)
- `healecho-infra/lambda/user-preferences.ts` — 신규 Lambda
- `healecho-infra/lib/HealechoStack.ts` — UserPreferencesTable + Lambda + 라우트 추가
- `src/app/api/user/preferences/route.ts` — 신규 API Route
- `src/app/wellness/weekly-habit/page.tsx` → storage 레이어 + AWS hydrate/save
- `src/components/weekly-habit/CollapsibleVideoSection.tsx` → storage 레이어
- `src/components/BottomTab.tsx` → storage 레이어
- ⚠️ CDK deploy 필요 (아직 미실행)

### Phase 6 ✅ — 커스텀 습관/수면 로그/동적 키 전환
- `src/components/weekly-habit/PSQITest.tsx` → storage 레이어
- `src/app/mypage/sleep-history/page.tsx` → storage 레이어 (마이그레이션 순회용 raw localStorage 3곳 의도적 유지)
- `src/app/wellness/solution/player/page.tsx` → storage 레이어
- `src/app/wellness/solution/page.tsx` → storage 레이어

### Phase 7 ✅ — 구독 캐시 + UI 플래그 정리
- `src/auth/subscription.ts` → storage 레이어 (캐시 키 3종 + token)
- `src/app/wellness/psqi/page.tsx` → storage 레이어

### Phase 8 ✅ — userLogout() 통합 + user.ts 전체 전환
- `src/auth/user.ts` → `storage.clearUserData()` 통합 + 모든 localStorage 호출 → storage 레이어

## 앞으로 해야 할 일

### 그룹 B — 아직 전환되지 않은 페이지들 (총 ~30 localStorage 호출)

사용자 데이터 키 또는 `user_id_token`을 직접 읽는 파일들. 대부분 `user_id_token` → `storage.getRaw("user_id_token")` 패턴이며, 사용자 데이터 키는 `storage.get()` + `migrateKey()`.

| 파일 | 호출 수 | 주요 내용 |
|---|---|---|
| `src/app/mypage/page.tsx` | 17 | 실천 기록 마이그레이션 (old localStorage → AWS), `user_id_token`, `practice_records_migrated` 등. sleep-history와 동일하게 마이그레이션 순회는 raw 유지 가능 |
| `src/app/mypage/wellness-record/page.tsx` | 2 | `user_id_token` + `weekly_habit_custom_items` 폴백 |
| `src/app/mypage/settings/subscription/page.tsx` | 1 | `user_id_token` |
| `src/app/mypage/settings/subscription/cancel/page.tsx` | 2 | `user_id_token` × 2 |
| `src/app/mypage/settings/subscription/change-payment/page.tsx` | 1 | `user_id_token` |
| `src/app/mypage/settings/account/page.tsx` | 1 | `user_login_method` |
| `src/app/mypage/settings/withdraw/page.tsx` | 1 | `localStorage.clear()` → `storage.clearUserData()` + 인증 키 제거로 교체 |
| `src/app/understanding/page.tsx` | 1 | `user_id_token` |
| `src/app/wellness/balance/player/page.tsx` | 1 | `user_id_token` |
| `src/components/weekly-habit/HabitTracker.tsx` | 2 | `user_id_token` × 2 |

### 그룹 A — 소셜 로그인 인증 모듈 (총 ~104 localStorage 호출)

앱 연동 시 필수. 모두 글로벌 키이므로 `storage.getRaw/setRaw/removeRaw`로 전환.

| 파일 | 호출 수 | 주요 내용 |
|---|---|---|
| `src/auth/kakao.ts` | 29 | 카카오 로그인 토큰/프로필 저장, 로그아웃 정리 |
| `src/auth/google.ts` | 22 | 구글 로그인 토큰/프로필 저장, 로그아웃 정리 |
| `src/auth/naver.ts` | 22 | 네이버 로그인 토큰/프로필 저장, 로그아웃 정리 |
| `src/auth/apple.ts` | 20 | 애플 로그인 토큰/프로필 저장, 로그아웃 정리 |
| `src/auth/tokenManager.ts` | 8 | 토큰 갱신 시 localStorage 읽기/쓰기 |
| `src/auth/cognito.ts` | 3 | 레거시 토큰 정리 |

### 그룹 C — 의도적 유지 (전환 불필요)

| 파일 | 사유 |
|---|---|
| `src/app/mypage/sleep-history/page.tsx` (3곳) | old 키 수집용 1회성 마이그레이션 순회. AWS 이전 완료 후 플래그로 재실행 안 됨 |

### 주석만 남은 파일 (전환 불필요, 용어 정리 권장)

| 파일 |
|---|
| `src/app/api/user/selfcheck-result/route.ts` (1곳, 주석) |
| `src/app/home/pricing/page.tsx` (1곳, 주석) |
| `src/app/public/billing/callback/page.tsx` (1곳, 주석) |
| `src/app/wellness/solution/self-check/result/page.tsx` (1곳, 주석) |

## 작업 규칙

1. **한 파일씩 작업**합니다.
2. 각 파일 작업 후 **변경 내용과 다음 작업을 설명**합니다.
3. **"승인" 받은 후 다음 파일**을 진행합니다.
4. 질문이 있으면 먼저 물어봅니다.
5. 그룹 B → 그룹 A 순서로 진행합니다.
6. 모든 파일 전환 후 `npx tsc --noEmit`으로 타입 체크합니다.

## 참고 문서

- `docs/storage-migration-plan.md` — 전체 마이그레이션 설계
- `docs/localStorage-vs-AWS-data-map.md` — 키 매핑
- `src/lib/storage.ts` — 추상화 레이어 API

## storage.ts API 요약

```typescript
// 글로벌 키 (인증 토큰 등 — userId 접두사 없음)
storage.getRaw(key): string | null
storage.setRaw(key, value): void
storage.removeRaw(key): void

// 사용자 데이터 키 (userId 자동 포함)
storage.get(key): string | null
storage.set(key, value): void
storage.remove(key): void
storage.getJSON<T>(key): T | null
storage.setJSON(key, value): void

// 유틸리티
storage.migrateKey(key): void  // old key → key__userId (1회성, 멱등)
storage.userKey(key): string   // key__userId 반환
storage.clearUserData(): void  // 로그아웃 시 사용자 데이터 일괄 삭제
storage.getUserId(): string | null  // JWT sub 추출
```

## 전환 패턴 요약

| 기존 코드 | 전환 후 | 비고 |
|---|---|---|
| `localStorage.getItem("user_id_token")` | `storage.getRaw("user_id_token")` | 글로벌 키 |
| `localStorage.getItem("user_login_method")` | `storage.getRaw("user_login_method")` | 글로벌 키 |
| `localStorage.setItem(KEY_ID_TOKEN, token)` | `storage.setRaw(KEY_ID_TOKEN, token)` | 글로벌 키 |
| `localStorage.removeItem(KEY_KAKAO_ID)` | `storage.removeRaw(KEY_KAKAO_ID)` | 글로벌 키 |
| `localStorage.getItem("weekly_habit_custom_items")` | `storage.migrateKey(...) + storage.get(...)` | 사용자 데이터 키 |
| `localStorage.clear()` | `storage.clearUserData()` + 인증 키 `removeRaw` | 로그아웃/탈퇴 시 |
