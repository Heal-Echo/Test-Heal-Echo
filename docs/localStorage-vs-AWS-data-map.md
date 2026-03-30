# localStorage vs AWS 데이터 저장 맵

> 작성일: 2026-03-09
> 범위: src/ 전체 프로젝트 조사 결과

---

## 1. 인증 관련 (localStorage only — 재로그인 시 복원)

| localStorage 키 | 용도 | 사용 파일 | AWS 저장 | 캐시 삭제 시 영향 |
|---|---|---|---|---|
| `user_id_token` | Cognito ID 토큰 (JWT) | auth/user.ts, auth/kakao.ts, auth/naver.ts, auth/google.ts, auth/apple.ts, auth/tokenManager.ts | ❌ | 로그아웃됨 → 재로그인 필요 |
| `user_access_token` | Cognito Access 토큰 | auth/user.ts, auth/kakao.ts, auth/naver.ts, auth/google.ts, auth/apple.ts, auth/tokenManager.ts | ❌ | 로그아웃됨 → 재로그인 필요 |
| `user_email` | 사용자 이메일 | auth/user.ts, auth/kakao.ts, auth/naver.ts, auth/google.ts, auth/apple.ts | ❌ | 재로그인 시 복원 |
| `user_login_method` | 로그인 방식 (kakao/naver/google/apple/email) | auth/kakao.ts, auth/naver.ts, auth/google.ts, auth/apple.ts, mypage/settings/account | ❌ | 재로그인 시 복원 |
| `user_kakao_id` | 카카오 사용자 ID | auth/kakao.ts | ❌ | 재로그인 시 복원 |
| `user_kakao_nickname` | 카카오 닉네임 | auth/kakao.ts | ❌ | 재로그인 시 복원 |
| `user_kakao_profile_image` | 카카오 프로필 이미지 URL | auth/kakao.ts | ❌ | 재로그인 시 복원 |
| `user_naver_id` | 네이버 사용자 ID | auth/naver.ts | ❌ | 재로그인 시 복원 |
| `user_naver_nickname` | 네이버 닉네임 | auth/naver.ts | ❌ | 재로그인 시 복원 |
| `user_naver_profile_image` | 네이버 프로필 이미지 URL | auth/naver.ts | ❌ | 재로그인 시 복원 |
| `user_google_id` | 구글 사용자 ID | auth/google.ts | ❌ | 재로그인 시 복원 |
| `user_google_nickname` | 구글 닉네임 | auth/google.ts | ❌ | 재로그인 시 복원 |
| `user_google_profile_image` | 구글 프로필 이미지 URL | auth/google.ts | ❌ | 재로그인 시 복원 |
| `user_apple_id` | 애플 사용자 ID | auth/apple.ts | ❌ | 재로그인 시 복원 |
| `user_apple_nickname` | 애플 닉네임 | auth/apple.ts | ❌ | 재로그인 시 복원 |

---

## 2. 사용자 데이터 — localStorage + AWS 동시 저장

| localStorage 키 | 용도 | 사용 파일 | AWS API | 저장 방식 | 캐시 삭제 시 영향 |
|---|---|---|---|---|---|
| `selfcheck_result` | 자율신경 자가체크 결과 JSON | components/self-check/SelfCheckSurvey.tsx | `/api/user/selfcheck-result` POST/GET | localStorage 우선 + AWS fire-and-forget | ⚠️ AWS에 데이터 있으면 `fetchAndHydrateSelfCheckResult()`로 복원, 없으면 유실 |
| `selfcheck_done` | 자가체크 완료 플래그 | components/self-check/SelfCheckSurvey.tsx | (selfcheck_result와 함께) | localStorage 우선 | ⚠️ 위와 동일 |
| `weekly_habit_sleep_log_{YYYY-MM-DD}` | 일별 수면 기록 JSON | components/weekly-habit/PSQITest.tsx | `/api/user/sleep-log` POST/GET | localStorage 즉시 + AWS 비동기 | ⚠️ sleep-history 마이그레이션으로 복원 가능 (v4.1) |
| `user_profile` | 프로필 설정 JSON | app/home/profile-setup/page.tsx | AWS 직접 호출 (`${apiBase}/user/profile` PUT) | localStorage 백업 + AWS 직접 | ⚠️ AWS에 저장 성공했으면 복원 가능 (단, 프론트엔드에 복원 로직 없음) |
| `profile_setup_done` | 프로필 설정 완료 플래그 | app/home/page.tsx, app/home/profile-setup/page.tsx | (profile과 함께) | localStorage only | ❌ 유실 → 프로필 설정 화면 재표시 가능 |

---

## 3. 사용자 데이터 — AWS 전용 (localStorage는 토큰 참조만)

| 데이터 | AWS API | 사용 파일 | localStorage 관여 |
|---|---|---|---|
| 실천 기록 (practice-record) | `/api/user/practice-record` GET/POST | mypage/page.tsx, PSQITest.tsx, HabitTracker.tsx, player/page.tsx, understanding/page.tsx | `user_id_token`만 참조 (Authorization 헤더) |
| PSQI 결과 | `/api/user/psqi-result` GET/POST | weekly-habit/page.tsx, sleep-history/page.tsx, subscription/page.tsx | `user_id_token`만 참조 |
| 습관 추적 | `/api/user/habit-tracking` POST | HabitTracker.tsx | `user_id_token`만 참조 |
| 습관 추적 (주차별) | `/api/user/habit-tracking/{weekNumber}` GET | weekly-habit/page.tsx | `user_id_token`만 참조 |
| 수면 로그 | `/api/user/sleep-log` GET/POST | PSQITest.tsx, sleep-history/page.tsx | `user_id_token`만 참조 |
| 수면 로그 설정 | `/api/user/sleep-log/config` GET/POST | PSQITest.tsx, sleep-history/page.tsx | `user_id_token`만 참조 |
| 수면 습관 (관리자 설정) | `/api/public/sleep-habit/{program}/{weekNumber}` GET | weekly-habit/page.tsx | `user_id_token`만 참조 |
| 구독 정보 | `/api/user/subscription` GET/POST | auth/subscription.ts, player/page.tsx, withdraw/page.tsx | `user_id_token`만 참조 |
| 결제 정보 | `/api/user/billing/info` GET | subscription/page.tsx | `user_id_token`만 참조 |
| 결제 확인 | `/api/user/billing/confirm-payment` POST | billing/callback/page.tsx | `user_id_token`만 참조 |
| 결제 취소 | `/api/user/billing/cancel` POST | — | `user_id_token`만 참조 |
| 결제 키 발급 | `/api/user/billing/issue-key` POST | — | `user_id_token`만 참조 |
| 회원 탈퇴 | `/api/user/withdraw` POST | withdraw/page.tsx | `user_id_token`만 참조 |
| 사용자 프로필 | `/api/user/profile` PUT (AWS 직접 호출) | profile-setup/page.tsx | `user_id_token`만 참조 |
| 밸런스 영상 목록 | `/api/public/balance/videos/{program}` GET | player/page.tsx, solution/page.tsx, balance/player/page.tsx, subscription/page.tsx | 없음 (공개 API) |
| 위클리 해빗 콘텐츠 | `/api/public/weekly-habit/{program}/{weekNumber}` GET | weekly-habit/page.tsx | 없음 (공개 API) |

---

## 4. localStorage 전용 — AWS에 저장되지 않는 데이터

| localStorage 키 | 용도 | 사용 파일 | 캐시 삭제 시 영향 | 위험도 |
|---|---|---|---|---|
| `weekly_habit_selected_program` | 선택한 프로그램 ID | BottomTab.tsx, solution/page.tsx, weekly-habit/page.tsx | 프로그램 선택 화면 재표시 | 🟡 낮음 |
| `weekly_habit_program_confirmed` | 프로그램 선택 확정 플래그 | BottomTab.tsx, solution/page.tsx, weekly-habit/page.tsx | 프로그램 선택 화면 재표시 | 🟡 낮음 |
| `weekly_habit_change_used` | 프로그램 변경 사용 여부 | weekly-habit/page.tsx | 프로그램 변경 가능 상태로 초기화 | 🟡 낮음 |
| `weekly_habit_tracker_started` | 습관 트래커 시작 여부 | PSQITest.tsx | 트래커 초기 상태로 돌아감 | 🟡 낮음 |
| `weekly_habit_start_date` | 프로그램 시작일 | PSQITest.tsx, CollapsibleVideoSection.tsx | 시작일 초기화 → 주차 계산 오류 가능 | 🟠 중간 |
| `weekly_habit_custom_items` | 사용자 커스텀 습관 목록 | PSQITest.tsx, sleep-history/page.tsx | 기본 습관으로 초기화 | 🟠 중간 |
| `weekly_habit_psqi_popup_shown` | PSQI 팝업 표시 여부 | PSQITest.tsx | PSQI 팝업 재표시 | 🟡 낮음 |
| `weekly_habit_last_seen_week` | 마지막으로 본 주차 | CollapsibleVideoSection.tsx | 새 주차 알림 재표시 | 🟡 낮음 |
| `weekly_habit_first_visit_done` | 첫 방문 완료 플래그 | CollapsibleVideoSection.tsx | 첫 방문 안내 재표시 | 🟡 낮음 |
| `balance_video_played_{program}` | 영상 재생 시도 기록 | solution/player/page.tsx, solution/page.tsx | 첫 재생 로직 초기화 | 🟡 낮음 |
| `profile_setup_done` | 프로필 설정 완료 플래그 | home/page.tsx | 프로필 설정 화면 재표시 가능 | 🟠 중간 |
| `user_profile` | 프로필 데이터 JSON | profile-setup/page.tsx | AWS에 있으면 괜찮으나, 프론트엔드 복원 로직 없음 | 🟠 중간 |

---

## 5. 마이그레이션 상태 플래그

| localStorage 키 | 용도 | 현재 상태 | 비고 |
|---|---|---|---|
| `practice_records_migrated` | 실천 기록 마이그레이션 완료 | `"done"` | mypage/page.tsx — 안전장치 추가됨 (v4) |
| `sleep_logs_migrated` | 수면 로그 마이그레이션 완료 | `"done"` | sleep-history/page.tsx — v4.1에서 추가 |

---

## 6. 구독/결제 캐시 (localStorage → AWS 갱신형)

| localStorage 키 | 용도 | 사용 파일 | AWS 동기화 |
|---|---|---|---|
| `balance_subscription_{programId}` | 구독 상태 캐시 | auth/subscription.ts | `/api/user/subscription` GET으로 갱신 |
| `balance_watch_records_{programId}` | 시청 기록 캐시 | auth/subscription.ts | 서버 조회 후 캐시 |
| `balance_gift_cycle_{programId}` | 선물 주기 캐시 | auth/subscription.ts | 서버 조회 후 캐시 |
| `billing_programId` | 결제 중 프로그램 ID | home/pricing/page.tsx → billing/callback/page.tsx | 결제 콜백 후 삭제 |
| `billing_planType` | 결제 중 요금제 | home/pricing/page.tsx → billing/callback/page.tsx | 결제 콜백 후 삭제 |
| `billing_orderId` | 결제 중 주문 ID | home/pricing/page.tsx → billing/callback/page.tsx | 결제 콜백 후 삭제 |
| `billing_amount` | 결제 중 금액 | home/pricing/page.tsx → billing/callback/page.tsx | 결제 콜백 후 삭제 |

---

## 7. AWS API 프록시 전체 목록 (일반 사용자용)

| API 경로 | 메서드 | 인증 패턴 | 용도 |
|---|---|---|---|
| `/api/user/practice-record` | GET/POST | Pattern A ✅ | 실천 기록 조회/저장 |
| `/api/user/psqi-result` | GET/POST | Pattern A ✅ | PSQI 결과 조회/저장 |
| `/api/user/selfcheck-result` | GET/POST | Pattern A ✅ | 자가체크 결과 조회/저장 |
| `/api/user/sleep-log` | GET/POST | Pattern A ✅ | 수면 로그 조회/저장 |
| `/api/user/sleep-log/config` | GET/POST | Pattern A ✅ | 수면 로그 설정 조회/저장 |
| `/api/user/habit-tracking` | POST | Pattern A ✅ | 습관 체크 저장 |
| `/api/user/habit-tracking/{weekNumber}` | GET | Pattern A ✅ (v4) | 주차별 습관 체크 조회 |
| `/api/user/subscription` | GET/POST | Pattern A ✅ | 구독 정보 조회/저장 |
| `/api/user/billing/info` | GET | Pattern A ✅ | 결제 정보 조회 |
| `/api/user/billing/confirm-payment` | POST | Pattern A ✅ | 결제 확인 |
| `/api/user/billing/cancel` | POST | Pattern A ✅ | 결제 취소 |
| `/api/user/billing/issue-key` | POST | Pattern A ✅ | 결제 키 발급 |
| `/api/user/withdraw` | POST | Pattern A ✅ | 회원 탈퇴 |
| `/api/user/profile` | PUT (직접 호출) | Bearer 토큰 ✅ | 프로필 저장 |
| `/api/public/balance/videos/{program}` | GET | 없음 (공개) | 밸런스 영상 목록 |
| `/api/public/weekly-habit/{program}/{weekNumber}` | GET | 없음 (공개) | 위클리 해빗 콘텐츠 |
| `/api/public/sleep-habit/{program}/{weekNumber}` | GET | Pattern A ✅ (v4) | 수면 습관 목록 |

---

## 8. 위험 요약 — 캐시 삭제 시 데이터 유실 가능 항목

### 🔴 유실 위험 높음 (AWS 미저장 또는 복원 로직 없음)

| 키 | 이유 |
|---|---|
| `weekly_habit_start_date` | localStorage에만 존재, AWS 저장 없음, 삭제 시 주차 계산 오류 |
| `weekly_habit_custom_items` | localStorage에만 존재, sleep-log/config에 부분 저장되나 복원 로직 불완전 |
| `profile_setup_done` | localStorage에만 존재, 프론트엔드 복원 로직 없음 |
| `user_profile` | AWS에 저장되지만 프론트엔드에서 자동 복원(hydrate) 로직 없음 |

### 🟠 조건부 위험 (AWS fire-and-forget — 저장 실패 가능)

| 키 | 이유 |
|---|---|
| `selfcheck_result` / `selfcheck_done` | fire-and-forget POST → 401 실패 시 AWS 미저장, 복원 함수는 있으나 데이터가 없으면 무용 |
| `weekly_habit_sleep_log_*` | 동시 저장이지만 API 프록시가 과거 Pattern C였던 시점의 데이터는 AWS에 없을 수 있음 |

### 🟡 안전 (재로그인 또는 서버 조회로 복원)

| 키 | 이유 |
|---|---|
| `user_id_token` / `user_access_token` | 재로그인 시 복원 |
| `balance_subscription_*` / `balance_watch_records_*` | 서버 조회 시 갱신 |
| `weekly_habit_selected_program` / `weekly_habit_program_confirmed` | 사용자가 다시 선택하면 됨 |
| UI 플래그들 (first_visit, last_seen_week 등) | 기능에 영향 없음, 안내 재표시될 뿐 |

---

## 9. 수정 우선순위 (섹션 2 — localStorage + AWS 동시 저장 항목)

> 원칙: AWS를 primary(원본), localStorage를 cache(캐시)로 전환
> 저장 시 AWS 성공 확인 필수, 읽기 시 AWS 우선 → localStorage 폴백

### 🔴 P1: `selfcheck_result` / `selfcheck_done` (자율신경 자가체크) — ✅ 완료

- **수정 완료일**: 2026-03-09
- **수정 파일**: `src/components/self-check/SelfCheckSurvey.tsx`
- **수정 내용**:
  1. `postSelfCheckToAWS()` 헬퍼 함수 신설 — AWS POST 성공/실패를 boolean으로 반환
  2. `saveSelfCheckResult` → `async`로 변경. AWS POST 결과를 확인하고, 실패 시 `selfcheck_aws_pending` 플래그 설정
  3. `fetchAndHydrateSelfCheckResult`에 재시도 로직 추가: localStorage에 데이터 + `selfcheck_aws_pending` 플래그가 있으면 자동 재업로드
  4. `handleShowResult` → `async`로 변경. `setStep("result")`를 먼저 실행하여 UI 블로킹 없음
- **새 localStorage 키**: `selfcheck_aws_pending` — AWS 저장 실패 시 "true", 성공 시 제거
- **동작 흐름**:
  - 저장 시: localStorage 즉시 저장 → AWS POST 시도 → 실패 시 pending 플래그
  - 다음 접속 시: `fetchAndHydrateSelfCheckResult` 호출 → pending 감지 → 자동 재업로드
  - 캐시 삭제 후: AWS에서 hydrate하여 localStorage 복원 (기존 로직 유지)

### 🟠 P2: `user_profile` / `profile_setup_done` (프로필) — ✅ 완료

- **수정 완료일**: 2026-03-09
- **수정 파일**: `src/app/home/profile-setup/page.tsx`, `src/app/home/page.tsx`
- **수정 내용**:
  1. `profile-setup/page.tsx`: AWS PUT 결과 확인. 실패 시 `profile_aws_pending` 플래그 설정, 성공 시 제거
  2. `home/page.tsx`: `getUserInfo` import 추가. `checkProfileSetup()` async 함수로 리팩토링. localStorage에 `profile_setup_done` 있고 `profile_aws_pending` 있으면 AWS 재업로드. localStorage에 없으면 AWS GET으로 hydrate. AWS에도 없으면 프로필 설정 페이지 이동
- **새 localStorage 키**: `profile_aws_pending` — AWS 저장 실패 시 "true", 성공 시 제거
- **동작 흐름**:
  - 프로필 저장 시: localStorage 즉시 저장 → AWS PUT 시도 → 실패 시 pending 플래그
  - 다음 홈 접속 시: pending 감지 → 자동 재업로드
  - 캐시 삭제 후: AWS에서 hydrate → `profile_setup_done` + `user_profile` 복원 → 프로필 설정 화면 미표시

### 🟢 P3: `weekly_habit_sleep_log_*` (수면 로그) — 완료

- **현재 상태**: ✅ v4.1에서 sleep-history/page.tsx에 마이그레이션 코드 추가 완료
- **추가 수정 불필요**: PSQITest.tsx의 `saveSleepLogToAPI`는 이미 Authorization 포함, API 프록시도 Pattern A
