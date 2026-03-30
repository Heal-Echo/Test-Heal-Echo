# Heal Echo Home 페이지 — LocalStorage 의존성 분석 및 AWS 연동 리스크 평가

**2026년 3월 23일 | 모바일 웹/앱 전환 대비 기술 분석**

---

## 1. 분석 개요

Heal Echo의 `/home` 페이지를 중심으로, 현재 코드베이스가 localStorage/sessionStorage에 의존하는 패턴을 전반적으로 분석하였습니다. 향후 모바일 웹(인앱 브라우저)이나 React Native/Flutter 등의 네이티브 앱으로 전환할 때, localStorage에만 저장되어 AWS와 동기되지 않는 데이터가 유실되거나 충돌하는 문제가 발생할 가능성이 있는지 평가합니다.

**결론:** 현재 코드베이스는 이미 매우 잘 설계되어 있습니다. `storage.ts` 추상화 레이어가 존재하고, 핵심 데이터(프로필, 구독, 자가체크)는 이미 AWS API와 동기하며, localStorage는 캐시/폴백 역할을 합니다. 다만 일부 데이터는 아직 localStorage에만 존재하여 전환 시 보완이 필요합니다.

---

## 2. 현재 스토리지 아키텍처

### 2.1 storage.ts 추상화 레이어

`src/lib/storage.ts`는 모든 클라이언트 저장소 접근을 중앙화한 추상화 모듈입니다. 이 모듈은 향후 앱 전환을 명시적으로 고려하여 설계되었습니다.

| 계층 | 역할 | 앱 전환 시 |
|------|------|-----------|
| 기본 (getRaw/setRaw) | localStorage 직접 접근, 인증 토큰 등 공통 키 | AsyncStorage로 교체 |
| 사용자별 (get/set) | userId 접미사 자동 부여, 계정별 격리 | AsyncStorage + userId 키로 교체 |
| 세션 (getSession/setSession) | sessionStorage 추상화, 리다이렉트 경로 등 | 인메모리 Map 또는 Navigation params |
| 쿠키 (getCookie/deleteCookie) | OAuth 콜백 토큰 전달 | Deep link 파라미터 또는 RN 브릿지 |
| Cognito 어댑터 | SDK 내부 localStorage 접근 우회 | AsyncStorage 어댑터로 교체 |

**평가:** 추상화 레이어가 잘 설계되어 있어, 앱 전환 시 `storage.ts` 내부 구현만 교체하면 나머지 코드는 변경 없이 동작할 수 있습니다.

---

## 3. 데이터 흐름 분석: Home 페이지 중심

### 3.1 인증 토큰 (user_id_token, user_access_token)

**위험도: 🟢 낮음**

- 현재: localStorage에 JWT 토큰 저장, Cognito SDK도 `cognitoStorageAdapter`를 통해 추상화 레이어 경유
- `tokenManager.ts`가 만료 시 자동 갱신 처리
- 앱 전환 시: `cognitoStorageAdapter`를 AsyncStorage 기반으로 교체하면 SDK가 자동 대응
- **결론: 이미 추상화되어 있어 문제 없음**

### 3.2 프로필 데이터 (user_profile, profile_setup_done)

**위험도: 🟢 낮음**

- Home 페이지의 `checkProfileSetup()`이 이미 이중 전략을 구현:
  - 1차: localStorage에서 확인 (`profile_setup_done`)
  - 2차: 없으면 AWS API에서 hydrate 시도 (`GET /api/user/profile`)
  - 3차: AWS에도 없으면 프로필 설정 페이지로 이동
- `profile-setup`에서 저장 시: localStorage 백업 + AWS API PUT 동시 수행
- AWS 실패 시 `profile_aws_pending` 플래그로 재시도 로직 존재
- **결론: 이중화가 완벽하게 구현되어 있어 안전**

### 3.3 구독 정보 (balance_subscription_*)

**위험도: 🟢 낮음**

- `subscription.ts`의 `getSubscription()`이 서버 API 우선 + localStorage 캐시 폴백 구조
- `saveSubscription()`도 API PUT 우선, 토큰 없을 때만 캐시 전용
- pricing 페이지에서 결제 정보는 URL 파라미터로 전달 (localStorage 미사용)
- **결론: 서버 연동 완료, 안전**

### 3.4 시청 기록 (balance_watch_records_*)

**위험도: 🔴 높음**

- `getWatchRecords()` / `saveWatchRecord()`: **localStorage에만 저장**
- 서버 API 연동 없음 — 주석에도 "후속 단계에서 서버 이전 예정"으로 명시
- **영향: 기기 변경 시 시청 이력 전체 유실, 선물 사이클 진행도 초기화**
- **결론: 모바일 전환 전 반드시 AWS 연동 필요**

### 3.5 선물 사이클 (balance_gift_cycle_*)

**위험도: 🔴 높음**

- `getGiftCycle()` / `saveGiftCycle()`: **localStorage에만 저장**
- 4주 달성 기록, 선물 해금/만료 시점 등 중요 보상 데이터
- **영향: 기기 변경 시 사용자가 이미 달성한 선물 진행도 유실**
- **결론: 시청 기록과 함께 AWS 연동 필요**

### 3.6 자가체크 결과 (selfcheck_result, selfcheck_done)

**위험도: 🟢 낮음**

- self-check result 페이지: localStorage 확인 → 없으면 `fetchAndHydrateSelfCheckResult()`로 AWS hydrate
- `selfcheck_aws_pending` 플래그로 재시도 로직 존재
- **결론: 이중화 구현 완료**

### 3.7 위클리 해빗 데이터

**위험도: 🟡 중간**

- `weekly_habit_*` 키 그룹 (13개 이상): 프로그램 선택, 습관 트래커, 수면 로그 등
- `weekly_habit_sleep_log_*` 동적 키: 날짜별 수면 기록
- 현재 AWS 연동 여부 미확인 (`clearUserData`에서 삭제 대상으로만 관리)
- **결론: 수면 로그 등 중요 데이터는 AWS 연동 필요**

### 3.8 카카오 로그인 정보

**위험도: 🟡 중간**

- `user_kakao_id`, `user_kakao_nickname`, `user_kakao_profile_image`, `user_login_method`: localStorage에만 저장
- `getUserName()`이 카카오 닉네임을 localStorage에서 직접 읽음
- **영향: 기기 변경 시 카카오 사용자 이름이 표시되지 않음**
- **결론: Cognito 토큰에서 복원 가능하지만, 카카오 전용 정보는 별도 처리 필요**

---

## 4. 위험도 종합 매트릭스

| 데이터 영역 | 위험도 | AWS 연동 | 앱 전환 시 영향 |
|-------------|--------|----------|----------------|
| 인증 토큰 | 🟢 낮음 | ✅ 완료 (추상화) | storage.ts 교체만으로 대응 가능 |
| 프로필 설정 | 🟢 낮음 | ✅ 완료 (이중화) | AWS hydrate + pending 재시도 완비 |
| 구독 정보 | 🟢 낮음 | ✅ 완료 (API 우선) | 서버 우선 + 캐시 폴백 구조 작동 |
| 자가체크 결과 | 🟢 낮음 | ✅ 완료 (이중화) | AWS hydrate + pending 재시도 완비 |
| **시청 기록** | **🔴 높음** | **❌ 미완료** | **기기 변경 시 전체 유실, 선물 진행도 초기화** |
| **선물 사이클** | **🔴 높음** | **❌ 미완료** | **보상 데이터 유실, 사용자 불만 발생 가능** |
| 위클리 해빗 | 🟡 중간 | ❓ 미확인 | 습관 트래커/수면 로그 유실 가능 |
| 카카오 로그인 정보 | 🟡 중간 | ❌ 미완료 | 이름 미표시 (재로그인으로 복구 가능) |

---

## 5. 모바일 환경 특유 리스크

### 5.1 모바일 웹 (인앱 브라우저) 환경

- **iOS Safari의 ITP (Intelligent Tracking Prevention):** 7일간 미방문 시 localStorage 자동 삭제 가능성
- **iOS 홈 화면 추가 (PWA) 모드:** 별도 저장소 공간 사용, Safari와 공유 안 됨
- **저장소 용량 제한:** 모바일 브라우저는 일반적으로 5MB 제한
- **사용자가 브라우저 데이터 삭제 시:** 모든 localStorage 손실

### 5.2 네이티브 앱 (React Native/Flutter) 환경

- **localStorage API 자체가 존재하지 않음** → storage.ts를 AsyncStorage로 교체 필수
- **sessionStorage 대체:** 인메모리 Map 또는 Navigation params 필요
- **document.cookie 미지원** → OAuth 콜백을 deep link / RN bridge로 교체 필요
- **clearUserData()의 localStorage.length 열거 로직:** 키 레지스트리 패턴으로 교체 필요

### 5.3 멀티 디바이스 동기화 문제

- 사용자가 휴대폰 + 태블릿 + PC에서 사용할 경우
- localStorage에만 있는 데이터는 기기간 공유 불가
- **특히 시청 기록/선물 사이클:** 휴대폰에서 3주 달성 → 태블릿에서는 0주로 표시

---

## 6. localStorage에만 존재하는 데이터 목록

아래는 현재 AWS와 동기되지 않고 localStorage에만 존재하는 키 목록입니다.

| 키 | 설명 | 중요도 | 비고 |
|----|------|--------|------|
| balance_watch_records_{programId} | 영상 시청 기록 | 🔴 높음 | 선물 계산/UI에 직접 사용 |
| balance_gift_cycle_{programId} | 선물 사이클 진행 | 🔴 높음 | 보상 데이터 |
| weekly_habit_selected_program | 선택된 프로그램 | 🟡 중간 | 재선택으로 복구 가능 |
| weekly_habit_sleep_log_{date} | 날짜별 수면 기록 | 🟡 중간 | 기록 유실 시 복구 불가 |
| weekly_habit_custom_items | 사용자 커스텀 습관 | 🟡 중간 | 재입력 필요 |
| weekly_habit_start_date | 프로그램 시작일 | 🟡 중간 | 주차 계산에 영향 |
| weekly_habit_tracker_started | 트래커 시작 여부 | 🟢 낮음 | 재시작으로 복구 |
| weekly_habit_psqi_popup_shown | PSQI 팝업 표시 여부 | 🟢 낮음 | 재표시되어도 무해 |
| balance_video_played_{id} | 영상 재생 여부 | 🟢 낮음 | 재생 버튼 UI에만 영향 |
| play_attempted_{id} | 재생 시도 기록 | 🟢 낮음 | 재시도해도 무해 |
| user_kakao_id / nickname / image | 카카오 프로필 | 🟡 중간 | 재로그인으로 복구 가능 |
| psqi_skipped | PSQI 검사 건너뜀 여부 | 🟢 낮음 | 재표시되어도 무해 |

---

## 7. 권장 조치 사항

### 7.1 우선순위 1: 시청 기록 + 선물 사이클 AWS 연동

**긴급도: 🔴 높음 | 모바일 전환 전 필수**

- WatchRecord를 DynamoDB에 저장하는 API 엔드포인트 추가 (`PUT/GET /api/user/watch-records`)
- GiftCycle을 DynamoDB에 저장하는 API 엔드포인트 추가 (`PUT/GET /api/user/gift-cycle`)
- 구독 정보와 동일한 패턴 적용: 서버 API 우선 + localStorage 캐시 폴백
- `countQualifyingWeeksRolling()`과 같은 계산 로직을 서버에서도 실행 가능하게 구성

### 7.2 우선순위 2: 위클리 해빗 데이터 AWS 연동

**긴급도: 🟡 중간 | 모바일 전환 시 함께 처리**

- 수면 로그 (`weekly_habit_sleep_log_*`) API 연동
- 프로그램 선택/시작일 등 상태 데이터 API 연동
- 커스텀 습관 항목 (`weekly_habit_custom_items`) API 연동

### 7.3 우선순위 3: clearUserData() 개선

**긴급도: 🟡 중간 | 앱 전환 시 함께 처리**

- 현재 `localStorage.length` 기반 열거 로직 → 키 레지스트리 패턴으로 교체
- 주석에 이미 "향후 앱 전환 시 키 레지스트리 패턴 또는 접두사 기반 스캔으로 교체 필요" 명시되어 있음

### 7.4 우선순위 4: 오프라인 큐 강화

**긴급도: 🟢 낮음 | 품질 개선**

- 현재 `profile_aws_pending` / `selfcheck_aws_pending` 패턴을 시청 기록/선물 사이클에도 적용
- 오프라인 상태에서 데이터 저장 → 온라인 복귀 시 자동 동기화
- Service Worker 기반 백그라운드 싱크 검토

---

## 8. 결론

Heal Echo의 현재 코드베이스는 모바일 전환을 명확히 의식하고 설계된 흔적이 곳곳에 보입니다. `storage.ts` 추상화 레이어를 통해 전체 코드베이스가 localStorage에 직접 접근하지 않고, 프로필/구독/자가체크 등 핵심 데이터는 이미 AWS와 이중화되어 있습니다.

**주의가 필요한 영역은 시청 기록(WatchRecord)과 선물 사이클(GiftCycle)입니다.** 이 두 가지는 사용자의 활동 이력과 보상에 직결되는 중요 데이터임에도 불구하고 현재 localStorage에만 존재합니다. 모바일 앱으로 전환하기 전에 이 데이터들의 AWS 연동을 완료해야 합니다.

반면, 전반적인 아키텍처는 전환에 매우 유리합니다. `storage.ts`의 내부 구현을 AsyncStorage로 교체하는 것만으로 인증, 토큰 관리, Cognito SDK가 모두 자동으로 대응되며, API 연동이 완료된 데이터는 hydrate 패턴으로 안전하게 복원됩니다.

---

*Heal Echo Technical Analysis — Prepared by Claude*
