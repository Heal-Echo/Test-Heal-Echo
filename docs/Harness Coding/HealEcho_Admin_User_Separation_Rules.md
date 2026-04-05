# Heal Echo — Admin/User Separation Rules (관리자/사용자 분리 규칙)

> **Version:** 1.0
> **Date:** 2026-04-05
> **Purpose:** 사용자 페이지(public/user)와 관리자 페이지(admin)가 섞여 있는 부분을 식별하고, 안전하게 분리하기 위한 규칙
> **Scope:** 코드 분리만 다룬다. 기능 변경, UI 수정, 새 기능 추가는 이 문서의 범위가 아니다.

---

## 0. 핵심 원칙

### 0.1 작동하는 코드를 깨뜨리지 않는다
- 분리 작업의 목적은 **구조 개선**이다. **기능 변경이 아니다.**
- 분리 전후로 모든 기존 기능이 동일하게 작동해야 한다.
- import 경로가 변경되면, 해당 파일을 import하는 **모든 파일**을 찾아서 함께 수정한다.

### 0.2 잘 분리된 곳은 건드리지 않는다
- 이미 올바르게 분리된 부분은 **절대 수정하지 않는다.**
- "더 좋아 보이는" 구조로 리팩토링하고 싶어도, 이 문서에서 "분리 필요"로 지정한 항목만 수정한다.

### 0.3 한 번에 하나씩
- 파일 하나를 분리하면 → 관련 import 모두 수정 → 빌드 확인 → 다음 파일로 진행.
- 여러 파일을 동시에 분리하지 않는다. 문제가 생겼을 때 원인을 찾기 어려워진다.

### 0.4 분리 판단 기준
| 질문 | Yes → | No → |
|------|-------|------|
| 이 코드가 admin에서만 사용되는가? | admin 전용 파일로 이동 | 공용 유지 |
| 이 코드가 user에서만 사용되는가? | user 전용 파일로 유지 | 공용 유지 |
| admin과 user 모두 사용하는가? | **공용(shared)으로 유지** — 분리 대상 아님 | — |

---

## 1. 현재 분리 상태 진단

### 1.1 잘 분리되어 있는 부분 (건드리지 말 것)

| 영역 | 위치 | 상태 | 이유 |
|------|------|------|------|
| Admin 페이지 | `/src/app/admin/` | PASS | 독립된 route group, user 코드 import 없음 |
| User 페이지 | `/src/app/home/`, `/wellness/`, `/mypage/`, `/public/` | PASS | admin 코드 import 없음 |
| API Routes (admin) | `/src/app/api/admin/` | PASS | admin 전용 엔드포인트 |
| API Routes (user) | `/src/app/api/user/` | PASS | user 전용 엔드포인트 |
| API Routes (public) | `/src/app/api/public/` | PASS | 공개 엔드포인트 |
| Admin 컴포넌트 | `/src/components/admin/` | PASS | admin 페이지에서만 import |
| Admin Studio 컴포넌트 | `/src/components/adminStudio/` | PASS | admin studio 페이지에서만 import |
| User 컴포넌트 | `/src/components/publicSite/`, `weekly-habit/`, `self-check/` | PASS | user 페이지에서만 import |
| 공용 컴포넌트 | `/src/components/header.tsx`, `bottom-tab.tsx`, `video-player.tsx` | PASS | user 전용으로 적절히 사용됨 |
| Auth 모듈 | `/src/auth/` | PASS | user 전용, admin은 별도 Cognito pool 사용 |
| Middleware | `/src/middleware.ts` | PASS | admin 경로에만 적용 (matcher: `/admin/:path*`) |
| 공용 config | `/src/config/programs.ts`, `company.ts`, `routes.ts` | PASS | 도메인 데이터로서 admin/user 모두 사용 — 올바른 공유 |
| 공용 lib | `/src/lib/storage.ts`, `program-selection.ts`, `app-lifecycle.ts` | PASS | user 전용으로 적절히 사용됨 |
| 공용 types | `/src/types/subscription.ts`, `billing.ts`, `profile.ts`, `balance.ts` | PASS | 도메인 타입으로서 공유 적절 |

### 1.2 분리가 필요한 부분

| ID | 파일 | 문제 | 심각도 |
|----|------|------|--------|
| **SEP-01** | `src/api/client.ts` | admin API 함수와 public API 함수(`listPublicVideos`)가 한 파일에 혼재. admin 전용 타입(`BalanceVideo`, `WeeklyHabitContent`, `SleepHabitWeek`, `HabitItem`, `MultipartPart`, `CompleteUploadPayload`)도 이 파일에 정의됨 | 높음 |
| **SEP-02** | `src/config/constants.ts` | admin Cognito 설정(`ADMIN_USER_POOL_ID`, `ADMIN_CLIENT_ID`, `ADMIN_REGION`)과 user Cognito/OAuth 설정이 한 파일에 혼재. admin 전용 debug logging도 포함. `SESSION_STORAGE_KEY = "video-admin-session"`이라는 admin 전용 키가 공용 config에 있음 | 중간 |
| **SEP-03** | `src/types/video.ts` | admin 전용 타입(`UploadInitResponse`, `VideoMetaUpdate`)과 공용 타입(`Video`, `PlayerVideo`, `ApiListResponse`)이 한 파일에 혼재 | 낮음 |
| **SEP-04** | `src/config/server-constants.ts` | `UPSTREAM_BASE_URL`이 admin/public fallback 체인으로 정의됨 (`NEXT_PUBLIC_API_BASE_URL` → `NEXT_PUBLIC_ADMIN_API_GATEWAY_URL` → `ADMIN_API_GATEWAY_URL`). admin 전용 환경변수명이 공용 fallback에 포함 | 낮음 |

---

## 2. 분리 작업 상세 계획

### SEP-01: `src/api/client.ts` 분리

**현재 상태:**
- admin Axios 인스턴스 4개 (`adminApi`, `balanceAdminApi`, `weeklyHabitAdminApi`, `sleepHabitAdminApi`)
- public Axios 인스턴스 1개 (`publicApi`)
- admin 전용 함수 15개 + admin 전용 타입 6개
- public 함수 1개 (`listPublicVideos`) — **현재 어디서도 import하지 않음 (미사용)**
- 이 파일을 import하는 곳: `src/components/adminStudio/` 내 파일 10개 (전부 admin)

**분리 방법:**
1. `src/api/client.ts` → `src/api/admin-client.ts`로 **파일명 변경** (내용은 admin 전용이므로)
2. 미사용 `listPublicVideos` 함수와 `publicApi` 인스턴스 **제거**
3. `src/components/adminStudio/` 내 import 경로 10개를 `@/api/admin-client`로 변경

**검증 체크리스트:**
- [ ] `adminStudio/` 내 10개 파일의 import 경로가 모두 변경되었는가?
- [ ] `listPublicVideos`를 사용하는 곳이 정말 없는가? (Grep 재확인)
- [ ] 빌드 에러가 없는가?
- [ ] admin studio 기능이 정상 작동하는가?

---

### SEP-02: `src/config/constants.ts` 분리

**현재 상태:**
한 파일에 아래 5가지 종류의 설정이 섞여 있음:
1. 공용 설정: `API_URL`, `CLOUDFRONT_URL`, URL 생성 함수
2. Admin Cognito 설정: `ADMIN_USER_POOL_ID`, `ADMIN_CLIENT_ID`, `ADMIN_REGION`
3. User Cognito 설정: `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
4. OAuth 설정: Google, Apple, Kakao, Naver
5. Admin 전용: `SESSION_STORAGE_KEY`, debug logging

**분리 방법:**
1. Admin 전용 설정을 `src/config/admin-constants.ts`로 분리:
   - `ADMIN_USER_POOL_ID`, `ADMIN_CLIENT_ID`, `ADMIN_REGION`
   - `SESSION_STORAGE_KEY` (admin session용)
   - Admin debug logging
2. `src/config/constants.ts`에는 공용 + user 설정만 남김
3. admin 설정을 import하는 파일을 찾아서 경로 변경

**분리 전 확인 필수:**
- `ADMIN_USER_POOL_ID`, `ADMIN_CLIENT_ID`, `ADMIN_REGION`을 import하는 파일 목록 확인
- `SESSION_STORAGE_KEY`를 import하는 파일 목록 확인
- 이들이 admin 컨텍스트에서만 사용되는지 검증

**검증 체크리스트:**
- [ ] admin 설정을 import하는 모든 파일의 경로가 변경되었는가?
- [ ] user/public 페이지에서 `admin-constants.ts`를 import하는 곳이 없는가?
- [ ] 공용 constants.ts에 admin 전용 코드가 남아있지 않은가?
- [ ] 빌드 에러가 없는가?

---

### SEP-03: `src/types/video.ts` 분리

**현재 상태:**
- 공용 타입: `Video`, `PlayerVideo`, `ApiListResponse` — admin과 user 모두 사용
- Admin 전용 타입: `UploadInitResponse`, `VideoMetaUpdate` — admin studio에서만 사용
- 공용 함수: `normalizeToPlayerVideo`, `extractPlayerVideoById` — user 페이지에서 사용

**분리 방법:**
1. admin 전용 타입(`UploadInitResponse`, `VideoMetaUpdate`)을 `src/api/admin-client.ts`로 이동 (SEP-01 완료 후)
   - 이 타입들은 admin API client에서만 사용되므로 API client 파일에 함께 두는 것이 자연스러움
2. `src/types/video.ts`에는 공용 타입만 남김

**주의:** SEP-01 이후에 진행해야 함 (admin-client.ts가 먼저 생성되어야 타입 이동 가능)

**검증 체크리스트:**
- [ ] `UploadInitResponse`를 import하는 곳이 모두 admin 파일인가?
- [ ] `VideoMetaUpdate`를 import하는 곳이 모두 admin 파일인가?
- [ ] 공용 타입(`Video`, `PlayerVideo`)은 변경 없이 유지되는가?
- [ ] 빌드 에러가 없는가?

---

### SEP-04: `src/config/server-constants.ts` 정리

**현재 상태:**
```ts
export const UPSTREAM_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ??
  process.env.ADMIN_API_GATEWAY_URL ??
  null;
```
- admin 전용 환경변수(`ADMIN_API_GATEWAY_URL`)가 공용 fallback 체인에 포함

**분리 방법:**
1. `UPSTREAM_BASE_URL`의 fallback 체인에서 admin 전용 변수를 분리하여 의도를 명확히
2. admin API route와 user/public API route가 실제로 같은 upstream을 사용하는지 확인 후 판단

**주의:** 이 변경은 API route의 upstream 연결에 영향을 줄 수 있으므로, 실제 환경변수 값과 API Gateway 구성을 먼저 확인해야 한다. 확인 없이 분리하면 API가 깨질 수 있다.

**검증 체크리스트:**
- [ ] admin API route와 public API route의 upstream URL이 동일한가, 다른가?
- [ ] 환경변수 `.env.local`에 어떤 값이 설정되어 있는가?
- [ ] 분리 후에도 모든 API route가 올바른 upstream을 가리키는가?

---

## 3. 작업 순서

```
SEP-01 (api/client.ts 분리)
    ↓ 빌드 확인
SEP-02 (config/constants.ts 분리)
    ↓ 빌드 확인
SEP-03 (types/video.ts 분리) — SEP-01 결과에 의존
    ↓ 빌드 확인
SEP-04 (server-constants.ts 정리) — 환경변수 확인 후 진행 여부 결정
    ↓ 빌드 확인
```

**각 단계 완료 후 반드시 확인:**
1. `npm run build` 성공
2. admin 페이지 정상 작동
3. user 페이지 정상 작동
4. 변경된 import 경로가 모두 올바른지 Grep으로 재확인

---

## 4. 절대 하지 말 것 (Anti-Patterns)

| 금지 사항 | 이유 |
|-----------|------|
| 공용 config/types를 admin과 user로 강제 분리 | `programs.ts`, `Video` 타입 등은 양쪽 모두 필요한 도메인 데이터. 분리하면 중복 발생 |
| 기존 import 경로를 한꺼번에 변경 | 하나의 파일 분리 후 관련 import만 변경. 나머지는 다음 단계에서 |
| 분리하면서 함수 시그니처나 타입 변경 | 분리는 **위치 이동만**. 코드 내용 변경 금지 |
| 분리하면서 "개선" 추가 | 에러 핸들링 추가, 타입 강화, 네이밍 변경 등은 별도 작업으로 |
| 빌드 확인 없이 다음 단계 진행 | 각 단계에서 빌드 실패가 발생하면 즉시 수정 |
| `PASS`로 판정된 파일 수정 | 1.1 테이블에서 PASS인 항목은 이 작업에서 수정 대상이 아님 |

---

## 5. 분리 결과 검증 기준

모든 분리 작업 완료 후 아래 조건을 만족해야 한다:

### 5.1 import 방향 규칙
| From → To | 허용 여부 |
|-----------|-----------|
| admin 페이지 → `admin-client.ts` | O |
| admin 페이지 → `admin-constants.ts` | O |
| admin 페이지 → 공용 config/types | O |
| user 페이지 → 공용 config/types | O |
| user 페이지 → `admin-client.ts` | **X (금지)** |
| user 페이지 → `admin-constants.ts` | **X (금지)** |
| `admin-client.ts` → 공용 types | O |
| 공용 코드 → admin 전용 코드 | **X (금지)** |

### 5.2 최종 파일 구조 (분리 후 예상)
```
src/
├── api/
│   └── admin-client.ts          # admin 전용 API client + admin 전용 타입
├── config/
│   ├── constants.ts             # 공용 + user 설정
│   ├── admin-constants.ts       # admin 전용 설정
│   ├── server-constants.ts      # server-only 설정
│   ├── programs.ts              # 공용 (변경 없음)
│   ├── company.ts               # 공용 (변경 없음)
│   └── routes.ts                # 공용 (변경 없음)
├── types/
│   ├── video.ts                 # 공용 타입만 (admin 전용 타입 제거됨)
│   ├── subscription.ts          # 변경 없음
│   ├── billing.ts               # 변경 없음
│   ├── balance.ts               # 변경 없음
│   └── profile.ts               # 변경 없음
└── (나머지 모든 디렉토리 변경 없음)
```

### 5.3 Grep 검증 명령
분리 완료 후 아래를 실행하여 위반 사항이 없는지 확인:

```bash
# user 페이지에서 admin-client import 여부 (결과 0이어야 함)
grep -r "admin-client" src/app/home/ src/app/wellness/ src/app/mypage/ src/app/public/

# user 페이지에서 admin-constants import 여부 (결과 0이어야 함)
grep -r "admin-constants" src/app/home/ src/app/wellness/ src/app/mypage/ src/app/public/

# 공용 코드에서 admin 전용 코드 import 여부 (결과 0이어야 함)
grep -r "admin-client\|admin-constants" src/lib/ src/auth/ src/types/
```
