# Heal Echo — Structural Convergence Rules (구조적 수렴 검증 규칙)

> **Version:** 1.0
> **Date:** 2026-04-04
> **Purpose:** AI Agent(Claude Code, Cowork)가 Heal Echo 코드를 검증·수정·재검증할 때 준수해야 하는 구조적 규칙
> **Usage:** 이 문서를 Claude Code 또는 Cowork의 컨텍스트로 제공하여, 코드 검증 및 수정 시 일관된 기준을 적용합니다.

---

## 0. 용어 정의

| 용어 | 의미 |
|------|------|
| **Normal Form** | 모든 AI의 코드 출력이 수렴해야 하는 최종 구조적 형태 |
| **Harness Rule** | 코드의 구조적 일관성을 강제하는 개별 규칙 |
| **Convergence** | 서로 다른 AI가 동일한 구조적 출력을 생성하는 상태 |
| **Domain Model** | 비즈니스 도메인을 코드로 표현한 데이터 구조 |
| **Layer** | 관심사가 분리된 코드 계층 (Client, API Proxy, Lambda, Data) |
| **SSOT** | Single Source of Truth — 하나의 진실된 출처 |

---

## 1. 원칙 (Principles)

### 1.1 I/O Boundary (입출력 경계)
- 모든 외부 데이터(API 응답, 사용자 입력, localStorage)는 **진입 시점에서 즉시 타입 검증**한다.
- Zod schema 또는 TypeScript type guard를 사용한다.
- 검증되지 않은 외부 데이터가 비즈니스 로직에 도달해서는 안 된다.

### 1.2 No Hallucination (환각 금지)
- AI가 코드를 수정할 때 **존재하지 않는 파일, 함수, 타입을 참조해서는 안 된다**.
- 수정 전 반드시 `Read` 또는 `Grep`으로 실제 존재 여부를 확인한다.
- import 경로는 반드시 실제 파일 시스템 경로와 일치해야 한다.

### 1.3 Human-in-the-Loop (사람 확인)
- **구조적 변경**(새 레이어 추가, 디렉토리 이동, 패턴 변경)은 반드시 사용자 승인 후 진행한다.
- **단순 수정**(오타, 누락된 타입, 네이밍 교정)은 규칙에 따라 자동 진행 가능하다.
- 판단 기준: "이 변경이 다른 파일 3개 이상에 영향을 주는가?" → Yes면 승인 필요.

### 1.4 Audit Trail (감사 추적)
- 모든 검증 결과를 **PASS / FAIL / AUTOFIX** 세 가지 상태로 기록한다.
- 수정 사유를 한 줄로 기록한다 (예: "FAIL → AUTOFIX: 파일명 kebab-case 미준수, login-form.tsx로 변경").

### 1.5 Incremental Convergence (점진적 수렴)
- 한 번에 모든 것을 고치지 않는다.
- **카테고리별 검증 → 수정 → 재검증** 순서로 진행한다.
- 진행 순서: Naming → Structure → Domain → API → Data Flow.

---

## 2. 아키텍처 정의 (Architecture Definition)

### 2.1 Heal Echo 아키텍처: Feature-Based Layered Architecture

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 1: CLIENT (Browser)                               │
│  Next.js 14 App Router + React 18 + TypeScript           │
│  ├── /src/app/          → Pages (Route Handlers)         │
│  ├── /src/components/   → Reusable UI Components         │
│  ├── /src/auth/         → Authentication Logic           │
│  ├── /src/lib/          → Utility Functions               │
│  ├── /src/types/        → Type Definitions                │
│  └── /src/config/       → Configuration & Constants       │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTP/JSON (Axios)
┌────────────────▼─────────────────────────────────────────┐
│  LAYER 2: API PROXY (Next.js API Routes)                 │
│  /src/app/api/                                           │
│  ├── /public/*   → 인증 불필요 엔드포인트                  │
│  ├── /user/*     → JWT 인증 필요 엔드포인트                │
│  ├── /admin/*    → Admin 인증 필요 엔드포인트              │
│  └── /upload/*   → S3 Presigned URL 발급                  │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTP/REST (Bearer Token)
┌────────────────▼─────────────────────────────────────────┐
│  LAYER 3: BUSINESS LOGIC (AWS Lambda)                    │
│  /healecho-infra/lambda/                                 │
│  ├── user-*.ts     → 사용자 도메인 함수                    │
│  ├── admin-*.ts    → 관리자 도메인 함수                    │
│  ├── billing-*.ts  → 결제 도메인 함수                      │
│  └── public-*.ts   → 공개 도메인 함수                      │
└────────────────┬─────────────────────────────────────────┘
                 │ AWS SDK
┌────────────────▼─────────────────────────────────────────┐
│  LAYER 4: DATA (AWS Services)                            │
│  ├── DynamoDB    → NoSQL 데이터 저장                      │
│  ├── Cognito     → 인증 및 사용자 관리                    │
│  ├── S3          → 파일(영상, 이미지) 저장                 │
│  └── CloudFront  → CDN 배포                               │
└──────────────────────────────────────────────────────────┘
```

### 2.2 레이어 간 의존성 규칙

| 규칙 | 설명 |
|------|------|
| **단방향 의존** | Layer 1 → 2 → 3 → 4. 역방향 의존 금지 |
| **Proxy 역할** | Layer 2(API Routes)는 **순수 중계** 역할만 한다. 비즈니스 로직 금지 |
| **Type 공유** | `/src/types/`의 타입은 Layer 1과 2에서만 사용. Layer 3은 자체 타입 정의 |
| **Config 격리** | 환경변수는 `.env.local` → `/src/config/constants.ts` → 코드 순서로 전파 |

---

## 3. 도메인 모델 (Domain Model)

### 3.1 핵심 도메인

| Bounded Context | 설명 | 주요 Entity |
|----------------|------|------------|
| **User** | 사용자 인증·프로필·온보딩 | User, Profile, Preferences |
| **Subscription** | 구독 라이프사이클·결제 | Subscription, BillingRecord, TransactionRecord |
| **Content** | 웰니스 콘텐츠(영상·습관) 관리 | Video, BalanceVideo, WeeklyHabit, SleepHabit |
| **Tracking** | 사용자 활동 추적·기록 | WatchRecord, HabitTracking, SleepLog, PracticeRecord |
| **Assessment** | 자가진단·PSQI·리포트 | SelfCheckResult, PsqiResult |
| **Reward** | 보상 사이클·동기부여 | GiftCycle |
| **Admin** | 관리자 도구·대시보드 | AdminUser, DashboardStats |

### 3.2 구독 상태 모델 (Subscription State Machine)

```
browser → browser_selected → free_trial → paid
                                ↓            ↓
                          free_stopped   paid_stopped
```

| 상태 | 의미 | 전이 조건 |
|------|------|----------|
| `browser` | 단순 방문자 | 초기 상태 |
| `browser_selected` | 프로그램 선택 완료 | 프로그램 선택 시 |
| `free_trial` | 7일 무료 체험 중 | 결제카드 등록 시 |
| `paid` | 유료 구독 활성 | 무료 체험 종료 후 자동 전환 |
| `paid_stopped` | 유료 구독 해지 | 구독 취소 시 |
| `free_stopped` | 무료 체험 해지 | 무료 체험 중 취소 시 |

### 3.3 도메인 모델 네이밍 규칙

| 항목 | 규칙 | 예시 |
|------|------|------|
| **타입명** | PascalCase, 도메인 의미 반영 | `UserSubscription`, `WatchRecord` |
| **필드명** | camelCase | `deliveryTime`, `minOrderAmount` |
| **DynamoDB 키** | PascalCase 또는 camelCase (기존 패턴 유지) | `userId`, `programId` |
| **API 응답** | camelCase (JSON) | `{ "subscriptionType": "paid" }` |
| **enum/union** | snake_case (문자열 리터럴) | `"free_trial"`, `"paid_stopped"` |

---

## 4. Harness Rules — 네이밍 (Naming)

### Rule N-01: 파일명 kebab-case
- **대상:** 모든 `.ts`, `.tsx` 파일
- **규칙:** 파일명은 반드시 `kebab-case`를 사용한다.
- **PASS:** `login-form.tsx`, `user-profile.ts`, `watch-record.ts`
- **FAIL:** `LoginForm.tsx`, `userProfile.ts`, `WatchRecord.ts`
- **Autofix:** 가능 (파일명 변환 + import 경로 일괄 수정)

### Rule N-02: 컴포넌트 export PascalCase
- **대상:** React 컴포넌트 export
- **규칙:** 컴포넌트의 export 이름은 `PascalCase`를 사용한다.
- **PASS:** `export function LoginForm()`, `export default function BottomTab()`
- **FAIL:** `export function loginForm()`, `export default function bottom_tab()`

### Rule N-03: 훅 함수 use 접두사
- **대상:** Custom Hook 파일 및 함수
- **규칙:** 훅 함수는 반드시 `use` 접두사로 시작한다.
- **PASS:** `useAuth()`, `useSubscription()`, `useVideoPlayer()`
- **FAIL:** `getAuth()`, `authHook()`, `subscriptionManager()`

### Rule N-04: 타입 파일과 타입명 일치
- **대상:** `/src/types/` 내 파일
- **규칙:** 파일명이 포함하는 도메인과 내부 타입명이 일치해야 한다.
- **PASS:** `video.ts` → `Video`, `PlayerVideo`, `UploadInitResponse`
- **FAIL:** `video.ts` → `ContentItem`, `MediaFile`

### Rule N-05: API Route 경로 RESTful
- **대상:** `/src/app/api/` 디렉토리
- **규칙:** API 경로는 `/{도메인}/{리소스}` 형태의 RESTful 구조를 따른다.
- **PASS:** `/api/user/profile`, `/api/admin/videos/[videoId]`
- **FAIL:** `/api/getUserProfile`, `/api/deleteVideo`

### Rule N-06: Lambda 함수명 도메인-액션
- **대상:** `/healecho-infra/lambda/` 파일
- **규칙:** `{도메인}-{액션}.ts` 형태를 사용한다.
- **PASS:** `user-profile.ts`, `admin-list-users.ts`, `billing-charge.ts`
- **FAIL:** `handleProfile.ts`, `listUsers.ts`, `charge.ts`

### Rule N-07: 상수 UPPER_SNAKE_CASE
- **대상:** 변경 불가능한 상수값
- **규칙:** 환경 설정값, 매직넘버 등은 `UPPER_SNAKE_CASE`를 사용한다.
- **PASS:** `PLAN_PRICES`, `API_URL`, `CLOUDFRONT_URL`
- **FAIL:** `planPrices`, `apiUrl`, `cloudfrontUrl`

### Rule N-08: Boolean 변수 is/has/can 접두사
- **대상:** Boolean 타입 변수 및 함수
- **규칙:** Boolean을 반환하거나 저장하는 변수는 `is`, `has`, `can`, `should` 접두사를 사용한다.
- **PASS:** `isLoading`, `hasSubscription`, `canAccessContent`
- **FAIL:** `loading`, `subscription`, `accessContent`

---

## 5. Harness Rules — 구조 (Structure)

### Rule S-01: 디렉토리 레이어 분리
- **대상:** `/src/` 디렉토리
- **규칙:** 아래 디렉토리 구조를 반드시 유지한다.

```
/src
├── app/            # Next.js App Router (페이지 + API Routes)
├── components/     # 재사용 가능한 UI 컴포넌트
├── auth/           # 인증 관련 로직
├── lib/            # 유틸리티 함수
├── types/          # TypeScript 타입 정의
├── config/         # 설정값 및 상수
└── middleware.ts   # Next.js 미들웨어
```

- **FAIL 조건:** 위 디렉토리 외에 임의의 최상위 디렉토리 생성 (예: `/src/services/`, `/src/hooks/`, `/src/utils/`)
- **예외:** 향후 모바일 연동 시 `/src/shared/` 추가는 승인 후 가능

### Rule S-02: 컴포넌트 기능별 폴더 분리
- **대상:** `/src/components/`
- **규칙:** 컴포넌트는 도메인/기능별 폴더로 분리한다.
- **PASS:** `/components/admin/`, `/components/weekly-habit/`, `/components/self-check/`
- **FAIL:** 모든 컴포넌트가 `/components/` 루트에 flat하게 존재

### Rule S-03: API Route 파일 단일 책임
- **대상:** `/src/app/api/` 내 `route.ts` 파일
- **규칙:** 각 route.ts는 하나의 리소스에 대한 HTTP 메서드만 처리한다.
- **PASS:** `/api/user/profile/route.ts` → GET, PUT만 처리
- **FAIL:** 하나의 route.ts에서 여러 도메인 리소스를 동시 처리

### Rule S-04: Page 컴포넌트 경량 유지
- **대상:** `/src/app/**/page.tsx`
- **규칙:** page.tsx는 레이아웃 조합과 데이터 흐름 연결만 담당한다. 비즈니스 로직, 복잡한 상태 관리는 별도 컴포넌트나 훅으로 분리한다.
- **기준:** page.tsx 파일이 **150줄 이하**여야 한다.

### Rule S-05: barrel export 금지
- **대상:** 모든 디렉토리
- **규칙:** `index.ts`를 통한 barrel export를 사용하지 않는다.
- **이유:** AI가 코드를 탐색할 때 실제 파일 위치를 추적하기 어렵게 만든다.
- **PASS:** `import { Video } from '@/types/video'`
- **FAIL:** `import { Video } from '@/types'` (index.ts barrel)

### Rule S-06: 환경변수 직접 참조 금지
- **대상:** `/src/config/` 외의 모든 파일
- **규칙:** `process.env.*`를 직접 사용하지 않는다. 반드시 `/src/config/constants.ts`를 통해 접근한다.
- **PASS:** `import { API_URL } from '@/config/constants'`
- **FAIL:** `const url = process.env.ADMIN_API_GATEWAY_URL`

---

## 6. Harness Rules — 도메인 (Domain)

### Rule D-01: 타입 정의 중앙화
- **대상:** TypeScript 인터페이스/타입
- **규칙:** 모든 공유 타입은 `/src/types/`에 정의한다. 컴포넌트 내 inline 타입 정의는 해당 컴포넌트에서만 사용되는 Props 타입에 한해 허용한다.
- **PASS:** `/src/types/subscription.ts`에 `SubscriptionType` 정의
- **FAIL:** 컴포넌트 파일 내부에 `SubscriptionType` 정의

### Rule D-02: 구독 상태 타입 엄격 관리
- **대상:** `SubscriptionType`
- **규칙:** 구독 상태는 반드시 `SubscriptionType` union 타입만 사용한다. 문자열 리터럴 직접 사용 금지.
- **PASS:** `if (sub.type === 'free_trial')` (타입이 SubscriptionType일 때)
- **FAIL:** `if (status === 'trial')` (정의되지 않은 상태값)

### Rule D-03: 프로그램 메타데이터 SSOT
- **대상:** 프로그램 관련 데이터
- **규칙:** 프로그램 ID, 이름, 설명은 반드시 `/src/config/programs.ts`에서만 정의한다. 하드코딩 금지.
- **PASS:** `import { PROGRAMS } from '@/config/programs'`
- **FAIL:** `const programName = "오토밸런스"` (하드코딩)

### Rule D-04: 인증 토큰 접근 단일 경로
- **대상:** JWT 토큰 관련 코드
- **규칙:** 토큰 읽기/쓰기/삭제는 반드시 `/src/auth/tokenManager.ts` 또는 `/src/lib/storage.ts`를 통해서만 한다.
- **FAIL:** 컴포넌트에서 직접 `localStorage.getItem('idToken')`

### Rule D-05: API 응답 타입 필수 정의
- **대상:** 모든 API 호출
- **규칙:** API 응답 데이터는 반드시 타입이 정의되어 있어야 한다. `any` 타입 사용 금지.
- **PASS:** `const res = await axios.get<UserSubscription>('/api/user/subscription')`
- **FAIL:** `const res = await axios.get('/api/user/subscription')` (타입 미지정)

---

## 7. Harness Rules — API 설계 (API Design)

### Rule A-01: API Route는 순수 Proxy
- **대상:** `/src/app/api/` 내 모든 route.ts
- **규칙:** API Route는 아래 작업만 수행한다:
  1. 요청에서 JWT 토큰 추출
  2. 요청 본문 유효성 검사 (크기, Content-Type)
  3. 업스트림 Lambda로 요청 전달
  4. Lambda 응답을 클라이언트에 반환
- **FAIL:** API Route 내에서 DynamoDB 직접 접근, 복잡한 데이터 변환, 비즈니스 로직 실행

### Rule A-02: HTTP 메서드 의미 준수
- **대상:** 모든 API 엔드포인트
- **규칙:**

| 메서드 | 용도 | 예시 |
|--------|------|------|
| GET | 조회 (부작용 없음) | 프로필 조회, 비디오 목록 |
| POST | 생성 | 시청 기록 저장, 결제 시작 |
| PUT | 전체 교체 | 프로필 업데이트, 습관 기록 |
| PATCH | 부분 수정 | 비디오 메타데이터 일부 수정 |
| DELETE | 삭제 | 비디오 삭제 |

### Rule A-03: 에러 응답 형식 통일
- **대상:** 모든 API 응답
- **규칙:** 에러 응답은 아래 형식을 따른다:
```json
{
  "error": "에러 코드 또는 메시지",
  "message": "사용자 친화적 설명 (선택)"
}
```
- HTTP 상태 코드: 400(잘못된 요청), 401(미인증), 403(권한 없음), 404(미발견), 500(서버 오류)

### Rule A-04: 플랫폼 비종속 설계
- **대상:** 모든 API 엔드포인트
- **규칙:** API는 웹 전용 로직(cookie, session, redirect)을 포함하지 않는다. 향후 모바일 앱에서도 동일한 API를 사용할 수 있어야 한다.
- **PASS:** JWT Bearer 토큰으로 인증
- **FAIL:** 쿠키 기반 세션 인증 (Admin API 예외 — 별도 관리)

---

## 8. Harness Rules — 데이터 흐름 (Data Flow)

### Rule DF-01: 단방향 데이터 흐름
- **규칙:** 데이터는 항상 **위에서 아래로** 흐른다.
```
Page → Component → Hook/Lib → API Route → Lambda → DynamoDB
```
- 역방향 데이터 전달은 **callback 함수** 또는 **상태 끌어올리기(lifting state)**로만 한다.

### Rule DF-02: localStorage는 캐시일 뿐
- **대상:** `/src/lib/storage.ts`
- **규칙:** localStorage는 AWS 데이터의 **로컬 캐시**로만 사용한다. localStorage만이 유일한 데이터 소스가 되어서는 안 된다 (오프라인 우선 UX를 위한 임시 저장은 허용하되, 반드시 AWS와 동기화해야 한다).
- **PASS:** `storage.set()` 후 AWS API도 호출하여 동기화
- **FAIL:** `storage.set()`만 호출하고 AWS 동기화 없음

### Rule DF-03: User-Scoped Storage 필수
- **대상:** localStorage에 저장하는 모든 사용자 데이터
- **규칙:** 사용자별 데이터는 반드시 userId 접두사가 붙은 키를 사용한다.
- **PASS:** `key__{userId}` 형태 (storage.ts의 `set()` 함수 사용)
- **FAIL:** `localStorage.setItem('selectedProgram', ...)` (사용자 구분 없음)

---

## 9. 검증-수정-재검증 프로세스 (V-M-V Process)

### 9.1 검증 순서

```
Phase 1: Naming Rules (N-01 ~ N-08)
    ↓ 결과 기록 → 수정 → 재검증
Phase 2: Structure Rules (S-01 ~ S-06)
    ↓ 결과 기록 → 수정 → 재검증
Phase 3: Domain Rules (D-01 ~ D-05)
    ↓ 결과 기록 → 수정 → 재검증
Phase 4: API Design Rules (A-01 ~ A-04)
    ↓ 결과 기록 → 수정 → 재검증
Phase 5: Data Flow Rules (DF-01 ~ DF-03)
    ↓ 결과 기록 → 수정 → 재검증
```

### 9.2 검증 결과 기록 형식

각 Phase 완료 시 아래 형식으로 결과를 보고한다:

```
## Phase {N}: {카테고리명} 검증 결과

| Rule | 대상 파일 | 상태 | 조치 내용 |
|------|----------|------|----------|
| N-01 | LoginForm.tsx | FAIL → AUTOFIX | login-form.tsx로 변경 |
| N-02 | login-form.tsx | PASS | — |
| N-03 | auth.ts | FAIL | useAuth로 변경 필요 (승인 대기) |

**Summary:** PASS: 5 / AUTOFIX: 2 / FAIL: 1
**다음 단계로 진행할까요?**
```

### 9.3 수정 규칙

| 상태 | 행동 |
|------|------|
| **PASS** | 수정 불필요. 다음 규칙으로 진행 |
| **AUTOFIX** | AI가 자동으로 수정 가능. 수정 후 재검증 |
| **FAIL** | 사용자 승인 필요. 수정 방안을 제시하고 승인 후 진행 |

### 9.4 재검증 기준

- 수정된 파일에 대해 **해당 Phase의 모든 규칙**을 재검증한다.
- 이전 Phase에서 PASS였던 항목이 수정으로 인해 FAIL이 되지 않았는지 확인한다.
- **Phase 전체 PASS율 100%**가 되어야 다음 Phase로 진행한다.

---

## 10. 모바일 앱 연동 준비 규칙 (Mobile Readiness)

### Rule M-01: API 독립성
- 모든 API 엔드포인트는 웹 프레임워크(Next.js)에 종속되지 않은 순수 HTTP 인터페이스여야 한다.

### Rule M-02: 인증 JWT 전용
- 세션 기반 인증 로직을 추가하지 않는다. 모든 인증은 JWT 기반이다.

### Rule M-03: 파일 업로드 S3 전용
- 서버 로컬 파일 저장 금지. 모든 파일은 S3 presigned URL을 통해 업로드한다.

### Rule M-04: 비즈니스 로직 분리
- UI 컴포넌트와 비즈니스 로직을 분리한다. 비즈니스 로직은 순수 함수 또는 훅으로 추출하여, 향후 React Native에서 재사용할 수 있도록 한다.

### Rule M-05: 하드코딩 금지
- URL, API 경로, 프로그램 ID, 가격 등 변경 가능한 값은 반드시 config 파일 또는 환경변수로 관리한다.

---

## 11. 인프라 규칙 (Infrastructure Rules)

### Rule I-01: CDK Stack 단일 진입점
- **대상:** `/healecho-infra/lib/HealechoStack.ts`
- **규칙:** 모든 AWS 리소스는 CDK Stack을 통해서만 생성한다. AWS 콘솔 수동 생성 금지.

### Rule I-02: Lambda 함수 단일 책임
- **대상:** `/healecho-infra/lambda/`
- **규칙:** 하나의 Lambda 함수는 하나의 비즈니스 작업만 수행한다.
- **PASS:** `user-profile.ts` → 프로필 CRUD만 처리
- **FAIL:** `user-all.ts` → 프로필 + 구독 + 시청기록 모두 처리

### Rule I-03: IAM 최소 권한 원칙
- **규칙:** Lambda 함수에는 필요한 DynamoDB 테이블과 작업(read/write)에 대한 권한만 부여한다.

---

## 12. 규칙 요약 (Rule Summary)

| Category | Rules | IDs |
|----------|-------|-----|
| Naming | 8 | N-01 ~ N-08 |
| Structure | 6 | S-01 ~ S-06 |
| Domain | 5 | D-01 ~ D-05 |
| API Design | 4 | A-01 ~ A-04 |
| Data Flow | 3 | DF-01 ~ DF-03 |
| Mobile Readiness | 5 | M-01 ~ M-05 |
| Infrastructure | 3 | I-01 ~ I-03 |
| **Total** | **34** | — |

---

## 13. AI Agent 지시사항 (Instructions for AI)

이 문서를 컨텍스트로 받은 AI는 아래를 준수합니다:

1. **문서를 먼저 읽고** 규칙을 이해한 후 작업을 시작한다.
2. **검증 시** 9.1의 순서대로 Phase별로 진행한다.
3. **수정 시** 9.3의 규칙에 따라 AUTOFIX/FAIL을 구분한다.
4. **재검증 시** 9.4의 기준에 따라 100% PASS를 확인한다.
5. **결과 보고** 시 9.2의 형식을 따른다.
6. **구조적 변경**은 반드시 사용자 승인 후 진행한다.
7. 이 문서에 없는 규칙을 임의로 추가하지 않는다.
8. 규칙 간 충돌 시 사용자에게 보고하고 판단을 요청한다.
