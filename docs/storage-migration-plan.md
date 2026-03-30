# localStorage → 서버 우선(Server-First) 마이그레이션 설계

> 작성일: 2026-03-20
> 최종 수정: 2026-03-20
> 목적: 앱 연동 대비 + 계정 간 데이터 오염 버그 해결
> 원칙: 한 번에 하나씩, 각 단계별로 테스트 가능하도록 설계
> 방향: **A — 스토리지 추상화 레이어 도입 후 전환** (향후 앱 전환 시 한 파일만 수정)
>
> ### 진행 상태
> - Phase 1: ✅ 완료 (2026-03-20) — userLogout()에 사용자 데이터 삭제 추가
> - Phase 2: ✅ 완료 (2026-03-20) — src/lib/storage.ts 스토리지 추상화 레이어 생성
> - Phase 3: ✅ 완료 (2026-03-20) — SelfCheckSurvey.tsx를 storage 레이어로 전환 + AWS 우선 조회
> - Phase 4~8: 미진행

---

## 배경

### 발견된 문제
1. **계정 간 데이터 오염**: `userLogout()` 실행 시 인증 토큰만 삭제되고, 사용자 데이터(selfcheck, profile 등)는 localStorage에 남아 있음. 다른 계정으로 로그인하면 이전 계정의 데이터가 그대로 표시됨.
2. **localStorage 키에 userId 없음**: `selfcheck_result`, `profile_setup_done` 등 고정 문자열 키를 사용하여, 같은 브라우저에서 계정 전환 시 데이터가 섞임.
3. **앱 비호환**: 모바일 앱(React Native 등)에서는 브라우저 localStorage가 존재하지 않아, 현재 코드를 그대로 사용할 수 없음.

### 이미 완료된 작업 (localStorage-vs-AWS-data-map.md 기준)
- P1: selfcheck AWS 동기화 + pending 재시도 ✅
- P2: profile AWS 동기화 + pending 재시도 ✅
- P3: sleep-log 마이그레이션 ✅

### 아직 해결되지 않은 것
- 로그아웃 시 사용자 데이터 미삭제
- localStorage 키에 userId 미포함
- 스토리지 추상화 레이어 부재
- localStorage 전용 데이터의 AWS API 부재

---

## 단계별 실행 계획

### Phase 1: 로그아웃 시 사용자 데이터 초기화

**목표**: 로그아웃할 때 인증 토큰뿐 아니라 사용자 데이터도 모두 삭제하여, 다른 계정으로 로그인했을 때 이전 데이터가 보이지 않도록 수정

**수정 파일**: `src/auth/user.ts` (1개)

**수정 내용**: `userLogout()` 함수에 아래 키들의 `removeItem` 추가

| 삭제할 키 | 용도 |
|---|---|
| `selfcheck_result` | 자가체크 결과 |
| `selfcheck_done` | 자가체크 완료 플래그 |
| `selfcheck_aws_pending` | 자가체크 AWS 재시도 플래그 |
| `user_profile` | 프로필 JSON |
| `profile_setup_done` | 프로필 완료 플래그 |
| `profile_aws_pending` | 프로필 AWS 재시도 플래그 |
| `psqi_skipped` | PSQI 건너뛰기 |
| `weekly_habit_selected_program` | 선택 프로그램 |
| `weekly_habit_program_confirmed` | 프로그램 확정 |
| `weekly_habit_change_used` | 프로그램 변경 사용 |
| `weekly_habit_tracker_started` | 습관 트래커 시작 |
| `weekly_habit_start_date` | 프로그램 시작일 |
| `weekly_habit_custom_items` | 커스텀 습관 |
| `weekly_habit_psqi_popup_shown` | PSQI 팝업 표시 |
| `weekly_habit_last_seen_week` | 마지막 본 주차 |
| `weekly_habit_first_visit_done` | 첫 방문 완료 |
| `practice_records_migrated` | 실천 기록 마이그레이션 |
| `sleep_logs_migrated` | 수면 로그 마이그레이션 |
| `balance_subscription_autobalance` | 구독 캐시 |
| `balance_watch_records_autobalance` | 시청 기록 캐시 |
| `balance_gift_cycle_autobalance` | 선물 주기 캐시 |

**주의**: `sleep_log_{날짜}` 키는 동적이므로 순회 삭제 필요 (`balance_video_played_` 동일)

**테스트 방법**:
1. 계정 A로 로그인 → 자가체크 완료 → subscription 페이지에서 불균형 신호 확인
2. 로그아웃
3. 계정 B(테스트)로 로그인 → subscription 페이지에서 "미검사" 표시 확인
4. 계정 A로 다시 로그인 → AWS에서 데이터 hydrate → 불균형 신호 정상 표시 확인

**위험도**: 🟢 낮음 (기존 동작 로직 변경 없음, 삭제 코드만 추가)

---

### Phase 2: 스토리지 추상화 레이어 생성

**목표**: localStorage 직접 호출을 대체할 중간 레이어를 만들어, 향후 앱 환경에서 저장소만 교체 가능하도록 준비

**수정 파일**: `src/lib/storage.ts` (신규 생성 1개)

**수정 내용**: 새 파일 생성만. 기존 코드는 건드리지 않음.

```
주요 기능:
- get(key): localStorage에서 읽기
- set(key, value): localStorage에 쓰기
- remove(key): localStorage에서 삭제
- clearUserData(): Phase 1에서 만든 삭제 로직을 여기로 이동
- getUserId(): 현재 로그인된 사용자 ID를 토큰에서 추출
- userKey(key): key → `${key}_${userId}` 변환 (userId 접두사 자동 추가)
```

**테스트 방법**: 새 파일이므로 기존 기능에 영향 없음. 단위 테스트 또는 콘솔에서 import하여 동작 확인.

**위험도**: 🟢 매우 낮음 (신규 파일, 기존 코드 미수정)

---

### Phase 3: SelfCheck를 스토리지 레이어로 전환

**목표**: `SelfCheckSurvey.tsx`의 localStorage 직접 호출을 Phase 2의 스토리지 레이어로 교체. 키에 userId가 포함되어 계정별 격리 달성.

**수정 파일**: `src/components/self-check/SelfCheckSurvey.tsx` (1개)

**수정 내용**:
- `localStorage.getItem("selfcheck_result")` → `storage.get(storage.userKey("selfcheck_result"))`
- `localStorage.setItem(...)` → `storage.set(...)`
- `fetchAndHydrateSelfCheckResult()` 내부의 로직 순서 변경: AWS 먼저 조회 → 실패 시 로컬 캐시 폴백

**테스트 방법**:
1. 기존 계정으로 로그인 → 자가체크 결과가 AWS에서 hydrate되어 정상 표시
2. localStorage에서 키 확인 → `selfcheck_result_abc123` 형태로 저장됨
3. 다른 계정으로 로그인 → 이전 계정 데이터 안 보임

**위험도**: 🟡 중간 (핵심 컴포넌트 수정이나, 동작 로직은 동일)

---

### Phase 4: Profile을 스토리지 레이어로 전환

**목표**: `profile-setup/page.tsx`, `home/page.tsx`의 localStorage 호출을 스토리지 레이어로 교체

**수정 파일**: `src/app/home/profile-setup/page.tsx`, `src/app/home/page.tsx` (2개)

**수정 내용**: Phase 3과 동일한 패턴 적용

**테스트 방법**:
1. 로그아웃 → 재로그인 → 프로필 설정 완료 상태가 AWS에서 복원되는지 확인
2. 다른 계정 로그인 → 프로필 설정 화면이 표시되는지 확인

**위험도**: 🟡 중간

---

### Phase 5: 프로그램 선택/시작일 데이터 처리

**목표**: `weekly_habit_selected_program`, `weekly_habit_start_date` 등 현재 localStorage 전용 데이터를 AWS에 저장

**수정 파일**:
- Lambda 신규: `healecho-infra/lambda/user-preferences.ts`
- API Route 신규: `src/app/api/user/preferences/route.ts`
- `src/app/wellness/weekly-habit/page.tsx`
- `src/components/weekly-habit/CollapsibleVideoSection.tsx`
- `src/components/BottomTab.tsx`

**수정 내용**:
1. DynamoDB에 `UserPreferencesTable` 추가 (또는 기존 `UsersTable` 활용)
2. Lambda + API Route로 GET/POST 엔드포인트 생성
3. 프론트엔드에서 스토리지 레이어를 통해 읽기/쓰기

**주의**: 이 단계는 AWS 인프라(CDK) 변경이 필요하므로 `cdk deploy` 필요

**테스트 방법**:
1. 프로그램 선택 → AWS에 저장 확인 (DynamoDB 콘솔)
2. localStorage 삭제 → 재접속 → AWS에서 복원 확인
3. 다른 기기에서 접속 → 같은 프로그램 선택 상태 확인

**위험도**: 🟠 높음 (인프라 변경 포함, 신중한 테스트 필요)

---

### Phase 6: 커스텀 습관 / 수면 로그 처리

**목표**: `weekly_habit_custom_items`와 동적 키(`sleep_log_{날짜}`, `balance_video_played_{program}`)를 스토리지 레이어로 전환

**수정 파일**:
- `src/components/weekly-habit/PSQITest.tsx`
- `src/app/mypage/sleep-history/page.tsx`
- `src/app/wellness/solution/player/page.tsx`
- `src/app/wellness/solution/page.tsx`

**수정 내용**:
- 동적 키에 userId 포함
- 기존 sleep-log API 활용 (이미 AWS 동기화 완료)
- `balance_video_played_`는 practice-record API와 통합 검토

**위험도**: 🟡 중간

---

### Phase 7: 구독/결제 캐시 + UI 플래그 정리

**목표**: `subscription.ts`의 캐시 키에 userId 추가, UI 플래그(`first_visit`, `last_seen_week` 등)를 스토리지 레이어로 전환

**수정 파일**:
- `src/auth/subscription.ts`
- `src/components/weekly-habit/CollapsibleVideoSection.tsx`
- `src/app/wellness/psqi/page.tsx`

**수정 내용**: 스토리지 레이어 적용 + userId 키 전환

**위험도**: 🟢 낮음 (캐시와 UI 플래그는 유실되어도 서버 조회 또는 재표시로 복구됨)

---

### Phase 8: userLogout()을 스토리지 레이어로 통합

**목표**: Phase 1에서 추가한 수동 removeItem 목록을 스토리지 레이어의 `clearUserData()`로 교체. Phase 2~7에서 등록된 모든 키를 자동 관리.

**수정 파일**: `src/auth/user.ts` (1개)

**수정 내용**: `userLogout()` 내 개별 removeItem 호출 → `storage.clearUserData()` 단일 호출

**위험도**: 🟢 낮음

---

## 실행 순서 요약

| 순서 | Phase | 수정 파일 수 | 인프라 변경 | 위험도 |
|---|---|---|---|---|
| 1 | 로그아웃 시 데이터 초기화 | 1 | ❌ | 🟢 |
| 2 | 스토리지 추상화 레이어 생성 | 1 (신규) | ❌ | 🟢 |
| 3 | SelfCheck 전환 | 1 | ❌ | 🟡 |
| 4 | Profile 전환 | 2 | ❌ | 🟡 |
| 5 | 프로그램 선택/시작일 (AWS 신규) | 5+ | ✅ CDK | 🟠 |
| 6 | 커스텀 습관/수면 로그 전환 | 4 | ❌ | 🟡 |
| 7 | 구독 캐시 + UI 플래그 정리 | 3 | ❌ | 🟢 |
| 8 | userLogout 통합 | 1 | ❌ | 🟢 |

---

## 중단 가능 지점

- Phase 1만 완료해도 계정 간 데이터 오염 버그는 해결됨
- Phase 1~4까지 완료하면 핵심 데이터(자가체크, 프로필)의 계정별 격리 달성
- Phase 5부터는 앱 연동이 본격적으로 필요한 시점에 진행해도 무방
