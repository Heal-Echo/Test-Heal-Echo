# 모바일 웹/앱 연동 준비 상태 검토 — 페이지별 리뷰

## 목적

Heal Echo 웹앱의 각 페이지를 **한 페이지씩** 검토하여, 향후 **모바일 웹** 및 **React Native 앱 전환** 준비 작업을 진행합니다. 검토의 핵심은 **localStorage와 AWS 연동**이며, 이를 포함한 브라우저 의존성을 체계적으로 점검하고 수정합니다.

## 핵심 원칙

- **localStorage/AWS 연동이 최우선 검토 대상**: 각 페이지에서 데이터가 localStorage와 AWS(Cognito, API Gateway, DynamoDB 등) 사이에서 어떻게 흐르는지 매핑하고, 추상화 레이어(`storage.ts`)를 경유하지 않는 접근을 식별하여 수정합니다.
- **추상화 레이어 일관성 확보**: 모든 스토리지 접근(localStorage, sessionStorage, cookie, Cognito SDK 내부)이 `storage.ts`를 경유하도록 통합합니다. 이를 통해 향후 앱 전환 시 `storage.ts` 내부 구현만 교체하면 전체 앱이 대응됩니다.
- **브라우저 의존성 점검**: localStorage/AWS 외에도 `window`, `document`, CSS, 네비게이션 등 브라우저 전용 API를 함께 검토합니다.

## 배경

- Storage Migration Phase 1~9 완료 (2026-03-22)
  - 대부분의 `localStorage` 직접 호출 → `src/lib/storage.ts` 추상화 레이어 전환
  - 단, Phase 1~9에서 다루지 못한 영역 존재: Cognito SDK 내부 localStorage, `document.cookie` 직접 접근 등
- `public/login` 심층 분석 완료 (2026-03-22)
  - localStorage/AWS 데이터 흐름 매핑 → 누락된 추상화 식별 → 코드 수정 완료
  - `cognitoStorageAdapter` 주입, 쿠키 추상화, 내부 일관성 개선
- 이후 페이지에서도 동일한 접근법(분석 → 매핑 → 추상화 수정)을 적용합니다

## 검토 대상 (admin 제외)

### 사용자 페이지 (26개)

| # | 경로 | 비고 |
|---|---|---|
| 1 | `src/app/home/page.tsx` | 메인 홈 |
| 2 | `src/app/home/pricing/page.tsx` | 가격 + 무료 체험 시작 |
| 3 | `src/app/home/profile-setup/page.tsx` | 프로필 설정 |
| 4 | `src/app/mypage/page.tsx` | 마이페이지 |
| 5 | `src/app/mypage/settings/page.tsx` | 설정 메인 |
| 6 | `src/app/mypage/settings/account/page.tsx` | 계정 관리 |
| 7 | `src/app/mypage/settings/subscription/page.tsx` | 구독 관리 |
| 8 | `src/app/mypage/settings/subscription/cancel/page.tsx` | 구독 해지 |
| 9 | `src/app/mypage/settings/subscription/change-payment/page.tsx` | 결제 수단 변경 |
| 10 | `src/app/mypage/settings/withdraw/page.tsx` | 회원 탈퇴 |
| 11 | `src/app/mypage/sleep-history/page.tsx` | 수면 기록 이력 |
| 12 | `src/app/mypage/wellness-record/page.tsx` | 웰니스 기록 |
| 13 | `src/app/public/landing/page.tsx` | 랜딩 페이지 |
| 14 | `src/app/public/login/page.tsx` | 로그인 |
| 15 | `src/app/public/pricing/page.tsx` | 공개 가격 페이지 |
| 16 | `src/app/public/billing/callback/page.tsx` | 결제 콜백 |
| 17 | `src/app/public/miraclereset/page.tsx` | 프로모션 |
| 18 | `src/app/understanding/page.tsx` | 이해의 바다 |
| 19 | `src/app/wellness/solution/page.tsx` | 웰니스 솔루션 메인 |
| 20 | `src/app/wellness/solution/player/page.tsx` | 솔루션 영상 플레이어 |
| 21 | `src/app/wellness/solution/self-check/page.tsx` | 자가 체크 |
| 22 | `src/app/wellness/solution/self-check/result/page.tsx` | 자가 체크 결과 |
| 23 | `src/app/wellness/weekly-habit/page.tsx` | 위클리 해빗 |
| 24 | `src/app/wellness/psqi/page.tsx` | PSQI 검사 |
| 25 | `src/app/wellness/balance/page.tsx` | 밸런스 메인 |
| 26 | `src/app/wellness/balance/player/page.tsx` | 밸런스 영상 플레이어 |

### 공통 컴포넌트 (사용자 영역, 8개)

| # | 경로 | 비고 |
|---|---|---|
| 27 | `src/components/Header.tsx` | 공통 헤더 |
| 28 | `src/components/BottomTab.tsx` | 하단 탭 네비게이션 |
| 29 | `src/components/LoginForm.tsx` | 로그인 폼 |
| 30 | `src/components/VideoPlayer.tsx` | 비디오 플레이어 |
| 31 | `src/components/self-check/SelfCheckSurvey.tsx` | 자가 체크 설문 |
| 32 | `src/components/weekly-habit/CollapsibleVideoSection.tsx` | 접이식 영상 섹션 |
| 33 | `src/components/weekly-habit/HabitTracker.tsx` | 습관 트래커 |
| 34 | `src/components/weekly-habit/PSQITest.tsx` | PSQI 테스트 |

### 인증 모듈 (6개)

| # | 경로 | 비고 |
|---|---|---|
| 35 | `src/auth/user.ts` | 사용자 인증 핵심 |
| 36 | `src/auth/kakao.ts` | 카카오 로그인 |
| 37 | `src/auth/google.ts` | 구글 로그인 |
| 38 | `src/auth/naver.ts` | 네이버 로그인 |
| 39 | `src/auth/apple.ts` | 애플 로그인 |
| 40 | `src/auth/tokenManager.ts` | 토큰 갱신 |

---

## 검토 항목 (체크리스트)

각 파일에 대해 아래 4개 카테고리를 확인합니다. **H가 최우선 검토 대상**입니다.

### ⭐ H. localStorage / AWS 데이터 흐름 (핵심)

- **각 페이지의 데이터가 localStorage ↔ AWS 사이에서 어떻게 흐르는지 매핑**
- `storage.ts` 추상화 레이어를 경유하지 않는 접근 식별 (직접 `localStorage`, `document.cookie`, SDK 내부 저장 등)
- Cognito SDK, 외부 라이브러리의 내부 localStorage 사용 여부 확인
- AWS API 호출과 localStorage 캐시의 관계 (읽기/쓰기 흐름, 동기화 방식)
- 수정 가능한 항목은 추상화 레이어 적용까지 진행
- **참고**: `public/login` 분석 사례 — Cognito SDK 커스텀 Storage 어댑터 주입, 쿠키 추상화, 내부 일관성 개선 (2026-03-22 완료)

### A. sessionStorage 의존성

- `sessionStorage`는 React Native에 존재하지 않음
- 사용 목적 분류: (1) 리다이렉트 경로 저장, (2) OAuth state 검증, (3) 로그아웃 출처 기록, (4) 기타
- 앱 전환 시 대체 전략 필요 여부 판단
- **현재 확인된 파일**: login/page.tsx, pricing/page.tsx, billing/callback/page.tsx, mypage/page.tsx, settings/page.tsx, kakao.ts, google.ts, naver.ts, apple.ts

### B. 네비게이션 / window.location / window.history

- `useRouter().push()` / `replace()` — 앱에서는 React Navigation으로 전환
- `router.back()` 사용 여부
- 하드코딩된 경로 문자열 (`"/public/login"`, `"/home"` 등)
- 딥링크 지원 필요 경로 식별
- `window.location.replace()` — 앱에서는 네비게이션 스택 교체로 대체 필요
- `window.location.href = url` — 소셜 로그인 리다이렉트, 앱에서는 WebView 또는 인앱 브라우저로 대체
- `window.location.origin` — 결제 콜백 URL 생성, 앱에서는 딥링크 스킴으로 대체
- `window.history.pushState()` — 뒤로가기 방지 패턴, 앱에서는 하드웨어 백버튼 처리로 대체
- **현재 확인된 파일**: home/page.tsx, pricing/page.tsx, solution/player/page.tsx, login/page.tsx, settings/page.tsx, mypage/page.tsx, withdraw/page.tsx, change-payment/page.tsx, billing/callback/page.tsx

### C. 기타 브라우저 의존성 (참고 기록용)

- 아래 항목은 현재 작업 범위(localStorage/AWS, 네비게이션) 밖이므로 **발견 시 기록만** 합니다
- document 객체 직접 접근 (`getElementById`, `addEventListener`, `body.style.overflow`)
- CSS / 레이아웃 호환성 (CSS Module, `vh`/`vw`, `position: fixed`, 미디어 쿼리)
- 결제/빌링 연동 (토스페이먼츠 SDK, 빌링키 플로우)
- 영상/미디어 재생 (HTML5 `<video>`, HLS 스트리밍)

---

## 작업 규칙

1. **한 파일씩 작업**합니다 — AI에게 파일 경로를 지정하여 검토를 요청합니다.
2. AI는 해당 파일을 읽고, 위 4개 카테고리(H, A, B, C)에 대해 검토 결과를 제출합니다. **H(localStorage/AWS 데이터 흐름)를 가장 먼저, 가장 깊이** 분석합니다.
3. 각 항목에 대해 다음 3단계로 분류합니다:
   - ✅ **호환** — 앱 전환 시 수정 불필요
   - ⚠️ **주의** — 앱 전환 시 수정 필요하지만, 현재 웹 동작에는 영향 없음 (기록만)
   - 🔴 **차단** — 앱 전환 시 반드시 해결해야 하는 핵심 이슈
4. 검토 결과를 간결한 표 형태로 정리합니다.
5. 검토 후, 현재 웹 동작을 깨뜨리지 않으면서 앱 전환 준비를 위해 수정 가능한 항목이 있으면 **수정 계획을 제시**합니다.
6. **한 번에 한 단계씩 작업**합니다:
   - 하나의 작업을 수행한 후, 수행한 작업에 대해 설명합니다.
   - 그 다음 작업이 무엇인지 설명합니다.
   - 반드시 **'승인'을 받은 후** 다음 작업을 진행합니다.
   - 승인 없이 여러 단계를 연속으로 진행하지 않습니다.
7. 모든 페이지 검토 완료 후, 종합 보고서를 작성합니다.

## 검토 결과 출력 형식 (파일당)

```
### [파일 경로]

| 카테고리 | 상태 | 발견 내용 | 앱 전환 시 대응 방안 |
|---|---|---|---|
| ⭐ H. localStorage/AWS | ✅/⚠️/🔴 | 데이터 흐름 매핑, 추상화 레이어 경유 여부 | 대응 방안 |
| A. sessionStorage | ✅/⚠️/🔴 | 구체적 내용 | 대응 방안 |
| B. 네비게이션/window | ✅/⚠️/🔴 | 구체적 내용 | 대응 방안 |
| C. 기타 브라우저 의존성 | 참고 | 발견 시 기록만 | — |
```

## 참고 문서

- `docs/storage-migration-plan.md` — 스토리지 마이그레이션 전체 설계
- `docs/localStorage-vs-AWS-data-map.md` — 키 매핑
- `# AI_CONTEXT.ini` — 프로젝트 전체 컨텍스트
- `src/lib/storage.ts` — 스토리지 추상화 레이어 API

## 페이지별 검토 결과

### `src/app/public/login/page.tsx` (검토일: 2026-03-22, 심층 보강: 2026-03-22)

| 카테고리 | 상태 | 발견 내용 | 앱 전환 시 대응 방안 |
|---|---|---|---|
| ⭐ H. localStorage/AWS 데이터 흐름 | ✅ 추상화 완료 (2026-03-22) | **모든 localStorage 접근이 storage.ts를 경유하도록 통합 완료.** (1) `storage.setRaw()`/`getRaw()`/`removeRaw()` — 인증 토큰·사용자 정보 15개 키 ✅ (2) Cognito SDK 내부 5~6개 키 → `cognitoStorageAdapter` 주입으로 storage.ts 경유 ✅ (3) `document.cookie` 접근 → `storage.getCookie()`/`storage.deleteCookie()` 추상화 ✅ (4) `tokenManager.ts` — `userPool`이 어댑터를 사용하므로 간접 해결 ✅ (5) `recordLogin()` → AWS API Gateway `POST /user/record-login` fire-and-forget ✅. **잔존**: `clearUserData()` 동적 키 열거 시 `localStorage.length`/`localStorage.key()` 직접 사용 (⚠️) | 앱 전환 시 storage.ts의 `getRaw/setRaw/removeRaw` 내부를 AsyncStorage로, `getCookie/deleteCookie`를 딥링크/브릿지로 교체. 동적 키 열거는 키 레지스트리 패턴으로 대체 |
| A. sessionStorage | ✅ 해결 완료 (2026-03-22) | **모든 sessionStorage 직접 호출 → `storage.ts` 추상화 레이어로 전환 완료.** (1) `getSession("redirect_after_login")` / `removeSession()` — login/page.tsx (2) `getSession("logoutFrom")` / `removeSession()` — login/page.tsx (3) `storage.clearSession()` — kakao.ts, user.ts, naver.ts, google.ts, apple.ts (4) `storage.setSession("xxx_oauth_state")` — naver.ts, google.ts, apple.ts (5) `setSession("redirect_after_login")` — pricing 2곳, billing/callback (6) `setSession("logoutFrom")` / `storage.setSession()` — mypage, settings. **프로젝트 전체 sessionStorage 직접 호출 0건 (storage.ts 내부 제외)** | ✅ 앱 전환 시 `storage.ts`의 `getSession/setSession/removeSession/clearSession` 내부 구현만 교체하면 됨 (예: 인메모리 Map, AsyncStorage 등) |
| B. window/history | 🔴 차단 | (1) `window.location.href = getKakaoLoginUrl()` 등 소셜 로그인 4종 — 외부 URL로 전체 페이지 이동 **(핵심 차단 이슈, 앱 전환 시)** (2) `window.history.pushState()` — 뒤로가기 방지 패턴 (3) `window.history.replaceState()` — 콜백 에러 시 URL 정리 (4) **쿠키 기반 토큰 전달 (🔴, 앱 전환 시)** — 소셜 로그인 콜백 시 `getCookie("cognito_id_token")`, `getCookie("cognito_access_token")`으로 `document.cookie`에서 토큰 읽음 → WebView의 SameSite/서드파티 쿠키 차단 정책에 의해 토큰 전달 실패 가능 (5) **환경 변수 의존 (⚠️)** — `recordLogin()` 함수가 `process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL`을 직접 참조하여 `fetch()` 호출. 네이티브 앱에서는 Next.js 환경 변수 시스템이 없으므로 별도 config 주입 필요 (6) **소셜 로그인 Redirect URI (⚠️)** — `NEXT_PUBLIC_KAKAO_REDIRECT_URI` 등 콜백 URL이 웹 도메인 기준. 앱에서는 Custom URL Scheme(예: `healecho://auth/kakao/callback`) 또는 Universal Link 기반 별도 URI 필요 (7) ✅ **소셜 로그인 확인 화면 (2026-03-22 해결)** — 카카오 `prompt: "login"`, 네이버 `auth_type: "reprompt"` 추가. 구글 기존 `prompt: "consent"`, 애플 자체 제공. 매번 계정 확인 후 로그인 진행 (8) ✅ **카카오 콜백 localhost 리다이렉트 버그 수정 (2026-03-22)** — `src/app/api/public/auth/kakao/callback/route.ts`에서 `new URL("/public/login", request.url)` → `request.headers.get("host")` 기반 origin 구성으로 변경. 모바일 웹(로컬 IP 접속) 시 localhost로 잘못 리다이렉트되는 문제 해결 | (1) `expo-auth-session` 또는 `WebBrowser.openAuthSessionAsync`로 소셜 로그인 대체 (2) `navigation.reset()` 사용 (3) 앱에서는 불필요 (딥링크 파라미터 처리) (4) 쿠키 대신 딥링크 URL 파라미터 또는 `postMessage`로 토큰 전달 방식 변경 (5) 앱 전용 config 파일 또는 react-native-config로 환경 변수 관리 (6) 소셜 로그인 제공자별 앱 전용 Redirect URI 등록 + 환경 변수 분리 |
| C. document 접근 | ✅ 추상화 완료 (2026-03-22) | login/page.tsx 자체에는 직접 접근 없음. `getCookie()`/`deleteCookie()`는 `storage.ts`에서 직접 import (kakao.ts re-export 경유하지 않음). `document.cookie` 접근은 storage.ts 내부에 격리됨 | 앱 전환 시 storage.ts의 `getCookie`/`deleteCookie` 내부를 딥링크 파라미터 또는 네이티브 브릿지로 교체 |
| D. CSS/레이아웃 | ⚠️ 주의 | (1) CSS Module 전면 사용 → RN StyleSheet 전환 필요 (2) `min-height: 100vh` 웹 전용 단위 (3) `border-radius`, `box-shadow`, `animation`, `@keyframes` RN 부분 지원 (4) `@media` 반응형 3단계 (768px/400px/769~1024px) → Dimensions API 대체 (5) `::placeholder` 가상 선택자 → `placeholderTextColor` 대체 (6) 모바일 웹에서는 잘 최적화됨: 768px 이하 좌측 브랜드 패널 숨김, 키보드 대응 `padding-bottom: 60px`, 터치 영역 44~52px 확보, `font-size: 16px`으로 iOS 자동 줌 방지 | 앱 전환 시 전체 UI를 RN 컴포넌트로 재구성 필요. 로직(인증 플로우)만 재사용 가능. 모바일 웹(WebView)에서는 현재 CSS 그대로 사용 가능 |
| E. 결제/빌링 | ✅ N/A | 결제 관련 로직 없음 | — |
| F. 영상/미디어 | ✅ N/A | 영상/미디어 재생 없음 | — |
| G. 네비게이션 | ⚠️ 주의 | (1) `router.replace(getPostLoginRedirect())` — 로그인 성공 후 리다이렉트 (2) 하드코딩 경로: `"/public/login"`, `"/home"` (3) **소셜 콜백 URL 파라미터 파싱 (추가 발견)** — `searchParams.get("kakao_cognito_callback")`, `google_cognito_callback`, `naver_cognito_callback`, `apple_cognito_callback` 등 4종의 콜백 파라미터를 `useSearchParams`로 읽음. 앱에서는 딥링크 파라미터로 대체 필요 | (1) `navigation.reset({routes: [{name: 'Home'}]})` 등으로 대체 (2) 하드코딩 경로를 상수/config로 추출 후 screen name 매핑 (3) 딥링크 핸들러에서 `kakao_cognito_callback=1` 등의 파라미터를 파싱하여 동일 로직 수행 |

#### 수정 완료 항목 (2026-03-22, 이번 세션)

| 수정 파일 | 변경 내용 | 목적 |
|---|---|---|
| `src/auth/kakao.ts` | `getKakaoLoginUrl()`에 `prompt: "login"` 파라미터 추가 | 매번 카카오 계정 확인 화면 표시 |
| `src/auth/naver.ts` | `getNaverLoginUrl()`에 `auth_type: "reprompt"` 파라미터 추가 | 매번 네이버 계정 확인 화면 표시 |
| `src/app/api/public/auth/kakao/callback/route.ts` | 모든 `NextResponse.redirect()`에서 `request.url` → `request.headers.get("host")` 기반 origin 구성으로 변경 | Next.js dev server가 `request.url`에 localhost를 반환하여 모바일 웹(로컬 IP 접속) 시 리다이렉트 실패하는 버그 수정 |
| `.env.local` | `NEXT_PUBLIC_KAKAO_REDIRECT_URI`를 `http://192.168.45.16:3000/...`으로 변경 (개발 환경 한정) | 모바일 웹 실기기 테스트용 로컬 IP 카카오 콜백 |
| `src/app/api/public/auth/naver/callback/route.ts` | 모든 `NextResponse.redirect()`에서 `request.url` → `request.headers.get("host")` 기반 origin 구성으로 변경 (4곳) | 카카오와 동일한 localhost 리다이렉트 버그 수정. 모바일 웹(로컬 IP) 네이버 로그인 시 잘못된 리다이렉트 방지 |
| `src/app/api/public/auth/google/callback/route.ts` | 모든 `NextResponse.redirect()`에서 `request.url` → `request.headers.get("host")` 기반 origin 구성으로 변경 (4곳) | 카카오와 동일한 localhost 리다이렉트 버그 수정. 모바일 웹(로컬 IP) 구글 로그인 시 잘못된 리다이렉트 방지 |
| `src/app/api/public/auth/kakao/callback/route.ts` | GET 핸들러 내 `const host/protocol/origin` 중복 선언(227~229줄) 제거. 상단 선언(151~153줄)의 `origin` 변수를 함수 전체에서 재사용 | 코드 품질 개선: 동일 스코프 내 `const` 중복 선언 정리 |
| `src/lib/storage.ts` | `getCookie()`/`deleteCookie()` 추상화 함수 추가, `cognitoStorageAdapter` 클래스 추가, `getUserId()`·`clearUserData()`·`migrateKey()` 내부의 직접 `localStorage` 호출을 `getRaw`/`setRaw`/`removeRaw`로 교체 | 앱 전환 준비: 모든 스토리지 접근을 추상화 레이어로 통합. storage.ts 내부 구현만 교체하면 전체 모듈 대응 가능 |
| `src/auth/kakao.ts` | `getCookie`/`deleteCookie` 함수 본문 제거 → `storage.ts`에서 re-export | `document.cookie` 직접 접근 제거. 기존 import 경로 하위 호환 유지 |
| `src/auth/user.ts` | `CognitoUserPool` 생성자에 `Storage: cognitoStorageAdapter` 옵션 추가 | Cognito SDK 내부 localStorage 직접 접근을 추상화 레이어로 경유 |
| `src/app/public/login/page.tsx` | `getCookie`/`deleteCookie` import 경로를 `@/auth/kakao` → `@/lib/storage`로 변경 | 쿠키 추상화 레이어 직접 참조로 전환 |

**✅ 해결 완료 (2026-03-22):** 네이버/구글 콜백 라우트에도 동일한 localhost 리다이렉트 문제 확인 → Host 헤더 기반 origin 구성으로 수정 완료. 카카오 콜백 라우트의 중복 변수 선언도 정리 완료. 애플 콜백 라우트는 기존 `getBaseUrl()` 헬퍼로 이미 올바르게 처리되어 수정 불필요

#### 심층 분석 보충: 인증 모듈 연계 (login/page.tsx가 의존하는 모듈)

| 모듈 | 앱 연동 이슈 | 상세 |
|---|---|---|
| `src/auth/user.ts` | ✅ 커스텀 Storage 어댑터 적용 완료 (2026-03-22) | `CognitoUserPool` 생성자에 `cognitoStorageAdapter` 주입. SDK 내부 localStorage 직접 접근이 `storage.ts`의 `getRaw/setRaw/removeRaw`를 경유하도록 변경. 향후 앱 전환 시 storage.ts만 교체하면 SDK도 자동 대응 |
| `src/auth/kakao.ts` | ✅ 쿠키 추상화 완료 (2026-03-22) | `getCookie`/`deleteCookie`를 `storage.ts`로 이전, kakao.ts에서 re-export. `document.cookie` 직접 접근 제거. 소셜 OAuth 리다이렉트(`window.location.href`)는 앱 전환 시 별도 대응 필요. ✅ `prompt: "login"` 추가로 매번 카카오 계정 확인 화면 표시 (2026-03-22) |
| `src/auth/google.ts` | 🔴 위와 동일한 패턴 (앱 전환 시) | `getGoogleLoginUrl()` → `window.location.href`. 콜백 시 쿠키 기반 토큰. 앱에서는 `@react-native-google-signin/google-signin` 또는 `expo-auth-session` 사용. ✅ 기존 `prompt: "consent"` 설정으로 확인 화면 이미 표시됨 |
| `src/auth/naver.ts` | 🔴 위와 동일한 패턴 (앱 전환 시) | `getNaverLoginUrl()` → `window.location.href`. 콜백 시 쿠키 기반 토큰. 네이버는 네이티브 SDK(`react-native-naver-login`) 사용 검토. ✅ `auth_type: "reprompt"` 추가로 매번 네이버 계정 확인 화면 표시 (2026-03-22) |
| `src/auth/apple.ts` | 🔴 위와 동일한 패턴 (앱 전환 시) | `getAppleLoginUrl()` → `window.location.href`. 콜백 시 쿠키 기반 토큰. iOS에서는 `@invertase/react-native-apple-authentication` 네이티브 SDK 사용 필수. ✅ 애플은 자체적으로 매번 인증 화면을 표시함 |
| `src/lib/storage.ts` | ✅ 추상화 완료 + 내부 일관성 개선 (2026-03-22) | `getRaw/setRaw/removeRaw` 내부만 교체하면 됨. `getUserId()`, `clearUserData()`, `migrateKey()` 내부의 직접 `localStorage` 참조를 추상화 함수로 교체 완료. 쿠키(`getCookie`/`deleteCookie`) 및 Cognito Storage 어댑터(`cognitoStorageAdapter`)도 추가됨. 잔존 이슈: `clearUserData()` 동적 키 열거 시 `localStorage.length`/`localStorage.key()` 사용 — 앱 전환 시 키 레지스트리 패턴 필요 |
| `src/auth/tokenManager.ts` | ✅ 간접 해결 (2026-03-22) | `ensureValidToken()`이 `userPool.getCurrentUser().getSession()`으로 토큰 갱신. `userPool`이 `cognitoStorageAdapter`를 사용하므로 SDK 내부 세션 읽기/갱신도 storage.ts를 경유. `hasValidToken()`과 갱신 후 저장도 `storage.getRaw()`/`storage.setRaw()` 사용 |

#### 심층 분석 보충: localStorage / AWS 데이터 흐름 (검토일: 2026-03-22)

login/page.tsx가 의존하는 모든 스토리지 및 AWS 상호작용을 경로별로 매핑한 결과입니다.

**분석 대상 파일 (11개):** login/page.tsx, storage.ts, user.ts, kakao.ts, naver.ts, google.ts, apple.ts, tokenManager.ts, 콜백 route.ts 4종

##### (A) 이메일 로그인 경로

| 단계 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|------|------|-----------|----------------|------|
| 1 | `userLogin()` → Cognito SDK `authenticateUser()` | Cognito API (AWS) | N/A | ✅ |
| 2 | Cognito SDK 내부 | `cognitoStorageAdapter` → `storage.ts`의 `getRaw/setRaw/removeRaw` 경유 (2026-03-22 수정). 키: `CognitoIdentityServiceProvider.{clientId}.{username}.idToken/accessToken/refreshToken/clockDrift`, `LastAuthUser` (5~6개 키) | ✅ 어댑터 경유 | ✅ 추상화 완료 |
| 3 | `storage.setRaw("user_id_token")` | localStorage → storage.ts | ✅ | ✅ |
| 4 | `storage.setRaw("user_access_token")` | localStorage → storage.ts | ✅ | ✅ |
| 5 | `storage.setRaw("user_email")` | localStorage → storage.ts | ✅ | ✅ |
| 6 | `recordLogin(idToken)` | `POST /user/record-login` (AWS API, fire-and-forget) | N/A | ✅ |
| 7 | `getSession("redirect_after_login")` | sessionStorage → storage.ts | ✅ | ✅ |
| 8 | `removeSession("redirect_after_login")` | sessionStorage → storage.ts | ✅ | ✅ |

##### (B) 소셜 로그인 경로 (카카오/네이버/구글/애플 공통)

| 단계 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|------|------|-----------|----------------|------|
| 1 | `getXxxLoginUrl()` | `setSession("xxx_oauth_state")` (네이버/구글/애플만) | ✅ | ✅ |
| 2 | `window.location.href = url` | 외부 OAuth 페이지 이동 | N/A | 🔴 앱 전환 시 대체 필요 |
| 3 | 서버 콜백 route.ts | Cognito AdminInitiateAuth (AWS), 쿠키에 토큰 설정 | N/A | ✅ (서버 사이드) |
| 4 | `getCookie("cognito_id_token")` | `storage.ts`의 `getCookie()` → `document.cookie` (2026-03-22 추상화 완료) | ✅ | ✅ 추상화 완료 |
| 5 | `getCookie("cognito_access_token")` | `storage.ts`의 `getCookie()` → `document.cookie` | ✅ | ✅ |
| 6 | `saveCognitoXxxSession()` | `storage.setRaw()` × 5~6회 (user_id_token, user_access_token, user_login_method, user_xxx_nickname, user_xxx_id, user_email) | ✅ | ✅ |
| 7 | `deleteCookie("cognito_id_token")` | `storage.ts`의 `deleteCookie()` → `document.cookie` (2026-03-22 추상화 완료) | ✅ | ✅ |
| 8 | `deleteCookie("cognito_access_token")` | `storage.ts`의 `deleteCookie()` → `document.cookie` | ✅ | ✅ |
| 9 | `recordLogin(idToken)` | `POST /user/record-login` (AWS API, fire-and-forget) | N/A | ✅ |

##### (C) 회원가입 / 비밀번호 찾기 경로

| 단계 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|------|------|-----------|----------------|------|
| 1 | `userSignup()` | Cognito SDK `signUp()` (AWS) + `storage.setRaw("user_email")` | ✅ | ✅ |
| 2 | `userConfirmSignup()` | Cognito SDK `confirmRegistration()` (AWS) | N/A | ✅ |
| 3 | `check-login-method` | `POST /api/public/auth/check-login-method` (Next.js → Lambda) | N/A | ✅ |
| 4 | `userForgotPassword()` | Cognito SDK `forgotPassword()` (AWS) + `storage.setRaw("user_email")` | ✅ | ✅ |
| 5 | `userConfirmPassword()` | Cognito SDK `confirmPassword()` (AWS) | N/A | ✅ |

##### localStorage 키 전체 목록 (login 경유, 15개)

| 키 | 용도 | 저장 시점 | AWS 저장 | storage.ts 경유 |
|---|---|---|---|---|
| `user_id_token` | Cognito ID 토큰 (JWT) | 로그인 성공 | ❌ (재로그인 시 복원) | ✅ |
| `user_access_token` | Cognito Access 토큰 | 로그인 성공 | ❌ | ✅ |
| `user_email` | 사용자 이메일 | 로그인/가입/비밀번호 찾기 | ❌ | ✅ |
| `user_login_method` | 로그인 방식 | 소셜 로그인 성공 | ❌ | ✅ |
| `user_kakao_id` | 카카오 사용자 sub | 카카오 로그인 | ❌ | ✅ |
| `user_kakao_nickname` | 카카오 닉네임 | 카카오 로그인 | ❌ | ✅ |
| `user_kakao_profile_image` | 카카오 프로필 이미지 | 카카오 로그인 | ❌ | ✅ |
| `user_naver_id` | 네이버 사용자 sub | 네이버 로그인 | ❌ | ✅ |
| `user_naver_nickname` | 네이버 닉네임 | 네이버 로그인 | ❌ | ✅ |
| `user_naver_profile_image` | 네이버 프로필 이미지 | 네이버 로그인 | ❌ | ✅ |
| `user_google_id` | 구글 사용자 sub | 구글 로그인 | ❌ | ✅ |
| `user_google_nickname` | 구글 닉네임 | 구글 로그인 | ❌ | ✅ |
| `user_google_profile_image` | 구글 프로필 이미지 | 구글 로그인 | ❌ | ✅ |
| `user_apple_id` | 애플 사용자 sub | 애플 로그인 | ❌ | ✅ |
| `user_apple_nickname` | 애플 닉네임 | 애플 로그인 | ❌ | ✅ |

참고: 위 15개 키는 모두 인증 전용이며 AWS에 별도 저장되지 않습니다. 재로그인 시 Cognito/소셜 OAuth에서 복원됩니다.

##### storage.ts 바깥 localStorage 사용 (Cognito SDK 내부, 5~6개 키)

| 키 패턴 | 용도 | 저장 주체 | 앱 전환 시 대응 |
|---|---|---|---|
| `CognitoIdentityServiceProvider.{clientId}.{username}.idToken` | SDK 세션 관리 | `amazon-cognito-identity-js` 내부 | custom storage adapter 주입 또는 SDK 교체 (`@aws-amplify/auth`) |
| `CognitoIdentityServiceProvider.{clientId}.{username}.accessToken` | 위와 동일 | SDK 내부 | 위와 동일 |
| `CognitoIdentityServiceProvider.{clientId}.{username}.refreshToken` | 토큰 자동 갱신용 | SDK 내부 | 위와 동일 |
| `CognitoIdentityServiceProvider.{clientId}.{username}.clockDrift` | 시간 보정 | SDK 내부 | 위와 동일 |
| `CognitoIdentityServiceProvider.{clientId}.LastAuthUser` | 마지막 인증 사용자 | SDK 내부 | 위와 동일 |

##### 앱 전환 시 대응 필요 항목 (우선순위순)

| 우선순위 | 항목 | 현재 상태 | 앱 대응 방안 |
|---------|------|----------|------------|
| ✅ 완료 | `amazon-cognito-identity-js` SDK 내부 localStorage | ~~storage.ts 바깥에서 직접 localStorage 사용~~ → `cognitoStorageAdapter`를 `CognitoUserPool` 생성자에 주입하여 해결 (2026-03-22). SDK가 `getRaw/setRaw/removeRaw`를 경유함. 향후 앱 전환 시 storage.ts 내부만 AsyncStorage로 교체하면 자동 대응 | 웹 환경에서는 완료. 앱 전환 시 storage.ts의 `getRaw/setRaw/removeRaw` 내부를 AsyncStorage로 교체 |
| ✅ 완료 | `document.cookie` 기반 소셜 토큰 전달 | ~~`kakao.ts`의 `getCookie/deleteCookie`가 `document.cookie` 직접 조작~~ → `storage.ts`의 `getCookie/deleteCookie` 추상화 함수로 이전 (2026-03-22). 기존 import 경로 하위 호환 유지(re-export) | 웹 환경에서는 완료. 앱 전환 시 storage.ts의 `getCookie`/`deleteCookie` 내부를 딥링크 파라미터 또는 `postMessage` 기반으로 교체 |
| ⚠️ 3순위 | `process.env.NEXT_PUBLIC_*` 환경 변수 | `recordLogin()`의 API URL, auth 모듈의 OAuth 설정값 등 | `react-native-config` 또는 앱 전용 config 파일로 분리 |
| ⚠️ 4순위 | `clearUserData()` 동적 키 열거 | `localStorage.length`/`localStorage.key(i)` 직접 사용 — 추상화 함수로 교체 불가 (키 열거 인터페이스 없음) | 앱 전환 시 키 레지스트리 패턴 또는 접두사 기반 키 목록 관리로 교체 필요 |

### `src/components/LoginForm.tsx` — 관리자용 (검토일: 2026-03-22)

| 카테고리 | 상태 | 발견 내용 | 앱 전환 시 대응 방안 |
|---|---|---|---|
| A~G 전체 | ✅ 호환 | 관리자 전용 컴포넌트 (Tailwind 유틸리티 클래스, `onLoggedIn` 콜백 방식). 앱 전환 대상 아님 | 관리자 페이지는 앱 전환 범위 밖 |

### `src/components/publicSite/PublicHeader.tsx` — 로그인 페이지 사용 (검토일: 2026-03-22)

| 카테고리 | 상태 | 발견 내용 | 앱 전환 시 대응 방안 |
|---|---|---|---|
| A. sessionStorage | ✅ 호환 | 사용 없음 | — |
| B. window/history | ⚠️ 주의 | `window.innerWidth` 참조 (resize 이벤트) — 창 크기 변경 시 메뉴 자동 닫기 | Dimensions API 또는 `useWindowDimensions`로 대체 |
| C. document 접근 | ⚠️ 주의 | `document.body.style.overflow = "hidden"` — 모바일 메뉴 열릴 때 스크롤 잠금 | RN Modal 컴포넌트 또는 ScrollView 제어로 대체 |
| D. CSS/레이아웃 | ⚠️ 주의 | (1) `position: sticky` + `position: fixed` RN 미지원 (2) CSS Module 전면 사용 (3) `@media` 반응형 breakpoint 다수 (4) `z-index` 계층 구조 (1000, 998, 999) | 앱에서는 React Navigation Header 또는 커스텀 네이티브 헤더로 완전 대체 |
| E. 결제/빌링 | ✅ N/A | — | — |
| F. 영상/미디어 | ✅ N/A | — | — |
| G. 네비게이션 | ⚠️ 주의 | Next.js `<Link>`로 하드코딩 경로 다수: `/public/landing`, `/public/miraclereset`, `/public/pricing`, `/public/login` | 앱에서는 PublicHeader 자체가 불필요할 가능성 높음 (공개 사이트 헤더 → 앱 네이티브 네비게이션으로 대체) |

### `src/app/home/page.tsx` (검토일: 2026-03-26)

| 카테고리 | 상태 | 발견 내용 | 앱 전환 시 대응 방안 |
|---|---|---|---|
| ⭐ H. localStorage/AWS 데이터 흐름 | ✅ 호환 | **모든 localStorage 접근이 storage.ts를 경유.** (1) `storage.get/set/getJSON/setJSON/remove/migrateKey` — 프로필 설정 확인, pending 재시도, 프로그램 선택 등 ✅ (2) `getUserInfo()` → `storage.getRaw("user_id_token")` 경유 ✅ (3) `getSubscription()` → API 우선 조회 + localStorage 캐시 fallback ✅ (4) `syncProgramSelection()` → storage + AWS preferences fire-and-forget ✅ (5) AWS API 호출 4종: `GET/PUT /api/user/profile`, `GET /api/user/subscription`, `PUT /api/user/preferences` 모두 Bearer 토큰 인증 ✅. **localStorage 직접 호출 0건, sessionStorage 0건, document.cookie 0건.** | 앱 전환 시 `storage.ts` 내부만 교체하면 자동 대응 |
| A. sessionStorage | ✅ 호환 | Home 페이지에서 sessionStorage 사용 없음 | 대응 불필요 |
| B. 네비게이션/window | ⚠️ 주의 | (1) `window.history.pushState()` — 뒤로가기 방지 패턴 (151, 155행). 앱에서는 React Navigation 스택 관리로 대체 (2) `window.history.replaceState()` — highlight query param 제거 (318행). 앱에서는 불필요 (딥링크 파라미터 소비 후 무시) (3) `document.visibilityState` + `document.addEventListener("visibilitychange")` — 앱 복귀 감지 (175, 185행). React Native에서는 `AppState` API로 대체 (4) `window.addEventListener("online")` — 인터넷 복구 감지 (186행). React Native에서는 `@react-native-community/netinfo`로 대체 (5) `document.getElementById("wellnessSection")` + `scrollIntoView()` — 모달 닫기 후 스크롤 이동 (347행). 앱에서는 `ScrollView` ref + `scrollTo`로 대체 (6) `router.replace("/public/login")` — 비로그인 시 리다이렉트 (96행). 앱에서는 `navigation.reset()` (7) `router.replace("/home/profile-setup")` — 프로필 미설정 시 이동 (141행). 앱에서는 `navigation.navigate()` (8) `router.push("/wellness/balance")` — 프로그램 선택 후 이동 (330, 573행). 앱에서는 `navigation.navigate()` | 모두 앱 전환 시 대체 필요하지만, 현재 웹 동작에는 영향 없음 (기록만) |
| C. 기타 브라우저 의존성 | 참고 | (1) `next/image` Image 컴포넌트 8회 사용 → 앱에서는 RN Image/FastImage로 대체 (2) CSS Module (`home.module.css`) 전면 사용 → 앱에서는 StyleSheet 또는 NativeWind (3) `next/link` Link 컴포넌트 4회 사용 → 앱에서는 Pressable + navigation (4) 마우스 드래그 이벤트 (mouseDown/Move/Up) — 카루셀 데스크톱 드래그 → 앱에서는 터치 제스처 자동 지원으로 불필요 (5) `useSearchParams()` → 앱에서는 route params | 앱 전환 시 UI 전체를 RN 컴포넌트로 재구성. 모바일 웹에서는 현재 그대로 사용 가능 |

#### Home 페이지 localStorage/AWS 데이터 흐름 상세

##### (A) 페이지 마운트 시 흐름

| 단계 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|------|------|-----------|----------------|------|
| 1 | `isUserLoggedIn()` | `storage.getRaw("user_id_token")` 존재 여부 확인 | ✅ | ✅ |
| 2 | `storage.migrateKey("user_profile")` 등 3건 | localStorage 키 마이그레이션 (userId 접두사 추가) | ✅ | ✅ |
| 3 | `storage.get("profile_setup_done")` | localStorage 읽기 | ✅ | ✅ |
| 4 | `retryPendingProfileSync()` | `storage.get("profile_aws_pending")` → `storage.getJSON("user_profile")` → `PUT /api/user/profile` → `storage.remove("profile_aws_pending")` | ✅ | ✅ |
| 5 | AWS profile hydrate (storage에 없을 때) | `GET /api/user/profile` → `storage.setJSON("user_profile")` + `storage.set("profile_setup_done")` | ✅ | ✅ |
| 6 | `getUserName()` | `storage.getRaw("user_email")` 등 경유 | ✅ | ✅ |
| 7 | `getSubscription(programId)` | `GET /api/user/subscription` → 캐시 저장 `storage.set("balance_subscription_{id}")` | ✅ | ✅ |

##### (B) 사용자 상호작용 흐름

| 단계 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|------|------|-----------|----------------|------|
| 1 | `getSelectedProgram()` | `storage.get("weekly_habit_selected_program")` + subscription 캐시 확인 | ✅ | ✅ |
| 2 | `isSelectionConfirmed()` | `storage.get("weekly_habit_program_confirmed")` + subscription 캐시 확인 | ✅ | ✅ |
| 3 | `syncProgramSelection("autobalance")` | `storage.set()` × 3건 + `PUT /api/user/preferences` fire-and-forget | ✅ | ✅ |

##### (C) 이벤트 기반 흐름

| 이벤트 | 호출 | 저장소/API | storage.ts 경유 | 상태 |
|--------|------|-----------|----------------|------|
| `visibilitychange` (앱 복귀) | `retryPendingProfileSync()` | `storage.get("profile_aws_pending")` → `PUT /api/user/profile` | ✅ | ✅ |
| `online` (인터넷 복구) | `retryPendingProfileSync()` | 위와 동일 | ✅ | ✅ |

#### Home 페이지 의존 모듈 검토

| 모듈 | 앱 연동 이슈 | 상세 |
|---|---|---|
| `src/lib/storage.ts` | ✅ 추상화 완료 | Home 페이지의 모든 스토리지 접근이 이 레이어 경유 |
| `src/auth/user.ts` | ✅ 커스텀 Storage 어댑터 적용 완료 (2026-03-22) | `isUserLoggedIn()`, `getUserName()`, `getUserInfo()` 모두 `storage.getRaw()` 경유 |
| `src/auth/subscription.ts` | ✅ 호환 | `getSubscription()` — API 우선 + localStorage 캐시 fallback. 모두 `storage.ts` 경유 |
| `src/lib/programSelection.ts` | ✅ 호환 | `getSelectedProgram()`, `isSelectionConfirmed()`, `syncProgramSelection()` 모두 `storage.ts` 경유 + AWS preferences 연동 |
| `src/config/programs.ts` | ✅ 호환 | 정적 설정 데이터만 포함 (스토리지/API 접근 없음) |

---

## 진행 현황

| # | 경로 | 상태 | 비고 |
|---|---|---|---|
| 13 | `src/app/public/landing/page.tsx` | ✅ 완료 | 모바일 웹 최적화 + 앱 연동 검토 (2026-03-22) — 반응형 줄바꿈, 터치 피드백, 카드 레이아웃, 비디오 영역, Empathy 프레임 등 |
| 14 | `src/app/public/login/page.tsx` | ✅ 완료 (심층 보강 + 수정) | 앱 연동 검토 + 수정 (2026-03-22) — ✅ sessionStorage 추상화 완료 (프로젝트 전체 11개 파일) + ✅ 소셜 로그인 확인 화면 추가 (카카오 `prompt=login`, 네이버 `auth_type=reprompt`, 구글 기존 `prompt=consent`, 애플 자체 제공) + ✅ 소셜 로그인 콜백 localhost 리다이렉트 버그 수정 — 카카오/네이버/구글 3종 완료 (`request.url` → `Host` 헤더 기반 origin 구성), 애플은 기존 `getBaseUrl()` 헬퍼로 이미 정상 + ✅ 카카오 콜백 중복 변수 선언 정리 + ✅ 모바일 웹 카카오 로그인 테스트 통과 (실제 스마트폰, 192.168.x.x) + 🔴 소셜 로그인 window.location.href 차단 (앱 전환 시) + 🔴 쿠키 기반 토큰 전달 차단 (앱 전환 시) + ⚠️ CSS·네비게이션·환경변수·Cognito SDK 의존·소셜 Redirect URI + 인증 모듈 연계 분석 |
| 29 | `src/components/LoginForm.tsx` | ✅ 완료 | 관리자 전용 — 앱 전환 범위 밖 (2026-03-22) |
| — | `src/components/publicSite/PublicHeader.tsx` | ✅ 완료 | 앱 연동 검토 (2026-03-22) — ⚠️ window/document/CSS/네비게이션 |
| 1 | `src/app/home/page.tsx` | ✅ 완료 | 앱 연동 검토 (2026-03-26) — ✅ localStorage/AWS 데이터 흐름 완전 호환 (직접 호출 0건, 모두 storage.ts 경유) + ✅ sessionStorage 미사용 + ⚠️ window.history/document.visibilityState/online 이벤트 등 브라우저 의존성 8건 (앱 전환 시 대체 필요, 웹 동작 영향 없음) + 참고: next/image·CSS Module·next/link·마우스 드래그 등 UI 의존성 |
| 15 | `src/app/public/pricing/page.tsx` | ⏳ 대기 | |

## 진행 시작 명령

```
1. '# AI_CONTEXT.ini'를 읽습니다.
2. 'prompt-mobile-app-readiness-review.md'를 읽습니다.
3. [검토할 파일 경로]를 읽고 검토합니다.
4. 모든 작업은 한 단계씩 차근 차근 진행합니다.
```
