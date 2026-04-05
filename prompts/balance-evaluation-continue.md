# wellness/balance 모듈 — 평가 및 수정 (이어서)

## 참조 문서
1. `docs/Harness Coding/HealEcho_Structural_Convergence_Rules.md`
2. `docs/Harness Coding/HealEcho_Evaluation_Framework.md`
3. CLAUDE.md

## 작업 범위
오직 `wellness/balance` 모듈만 작업합니다.

---

## 이전 세션에서 완료된 작업

### A. Structural Convergence Rules (Phase 1~5) 검증 완료

#### 수정 완료된 항목 (6건):
1. **D-01 (타입 중앙화)**: `/src/types/balance.ts` 신규 생성. `balance-brain.ts`, `player-brain.ts`의 로컬 타입 정의를 제거하고 중앙 타입 import로 전환
2. **D-02 (구독 타입 엄격 관리)**: `balance-brain.ts`의 자체 `SubscriptionInfo` 타입 제거 → `/src/types/subscription.ts`의 `UserSubscription` 사용. `isFreeTrial` → `subscriptionType === "free_trial"`, `trialEndsAt` → `trialEndDate`로 변경
3. **D-03 (프로그램 SSOT)**: `/src/config/programs.ts`에 `PROGRAM_ID` 상수 추가. `page.tsx`와 `use-balance-player.ts`에서 `"autobalance"` 하드코딩 → `PROGRAM_ID.AUTOBALANCE`로 변경
4. **D-05 (any 제거)**: `player-brain.ts`의 `any` 4건 → `unknown` + 런타임 타입 내로잉으로 교체. 함수명 `extractPlayerVideoByWeek` → `extractBalanceVideoByWeek`, 타입명 `PlayerVideo` → `BalanceVideo`로 변경
5. **DF-02 (localStorage 캐시 전용)**: `balance_hub_visited`를 `storage.set()`(localStorage) → `storage.setSession()`(sessionStorage)으로 변경. `page.tsx`와 `BottomTab.tsx` 양쪽 모두 수정 완료
6. **E1-01 (토큰 만료)**: `use-balance-player.ts`에서 `storage.getRaw("user_id_token")` → `getValidUserInfo()` (만료 시 자동 갱신)로 변경. `import * as storage` 제거됨

#### 미해결 FAIL (3건) — 모두 동일 원인:
`src/app/api/public/balance/videos/[program]/route.ts`의 임시 코드 (주석에 "A단계 임시 해결"로 명시)

| Rule | 문제 | 해결 시점 |
|------|------|----------|
| S-06 (환경변수 직접 참조) | `route.ts`에서 `process.env` 4건 직접 사용 | Lambda 공개 API 구축 시 |
| A-01 (API Route 순수 Proxy) | 관리자 쿠키 폴백 로직이 proxy 역할을 벗어남 | Lambda 공개 API 구축 시 |
| A-04 (플랫폼 비종속) | `cookies().get()` 사용 — 웹 전용 | Lambda 공개 API 구축 시 |

### B. Evaluation Framework — 완료된 카테고리

#### E1 Security: 90/100
- PASS: 로그인 가드, 콘텐츠 권한 체크(canPlayVideo), API 입력 검증, XSS 방지, 환경변수 안전, 토큰 자동 갱신(수정 완료)
- 잔존 FAIL (-10점): route.ts 쿠키 폴백 (Lambda 공개 API 구축 시 해결)

#### E2 Functionality: 80/100 — FAIL 2건 미수정
- PASS: 구독 상태별 접근 제어(6가지 모두), 비로그인 차단, 권한 없는 접근 리다이렉트, 프로필 설정 ≠ 프로그램 선택 독립
- **FAIL 1 (-15점): `balance-brain.ts`의 주차별 잠금/해금 로직 미연결** — `calculateBalanceState()` 함수가 7일/3회 시청 규칙을 구현하고 있지만 어느 페이지에서도 호출되지 않음. 현재 Player는 `canPlayVideo()`만으로 접근 제어
- **FAIL 2 (-5점): 권한 거부 시 사용자 안내 부족** — `use-balance-player.ts:52-55`에서 `canPlayVideo`가 `allowed: false`를 반환하면 즉시 `/wellness/balance`로 리다이렉트만 함. `reason` 값(`payment_required`, `week_locked`, `expired`)에 따른 안내 메시지 없음

---

## 이번 세션에서 해야 할 작업

### 1단계: E2 FAIL 2건 수정

#### (1) 권한 거부 안내 개선 (E2 FAIL 2)
- **파일**: `src/app/wellness/balance/player/use-balance-player.ts`
- **현재**: `playPermission`이 `allowed: false`이면 무조건 리다이렉트
- **수정**: `reason` 값에 따라 에러 메시지를 설정한 후 리다이렉트 또는 안내 표시
  - `payment_required` → 결제 필요 안내 (결제 페이지 유도)
  - `week_locked` → "아직 열리지 않은 주차입니다" 안내
  - `expired` → 구독 만료 안내 (재구독 유도)
- **범위**: `use-balance-player.ts` + `player/page.tsx` (UI 표시 부분)

#### (2) balance-brain 미연결 (E2 FAIL 1)
- **파일**: `balance-brain.ts`와 이를 사용할 페이지
- **문제**: `calculateBalanceState()`가 존재하지만 어디서도 호출되지 않음
- **판단 필요**: 이 로직을 연결하려면 시청 기록 API, solution 페이지 등 balance 모듈 밖의 파일도 수정해야 할 수 있음. 연결 범위를 확인한 후, balance 모듈 범위 내에서 가능한 만큼만 수정. 범위가 너무 크면 FAIL로 기록하고 다음 단계로 이동

### 2단계: E3~E7 평가 진행

E2 수정 완료 후, Evaluation Framework의 나머지 카테고리를 순서대로 평가합니다:

| 순서 | Category | Weight | 주요 확인 포인트 |
|------|----------|--------|-----------------|
| E3 | Error Handling (15%) | API route의 try-catch, 클라이언트 에러 메시지, 빈 상태 UI, 토큰 만료 대응 |
| E4 | Performance (15%) | Image 최적화, 중복 API 요청, useEffect 의존성, 미사용 import |
| E5 | Responsive & Accessibility (10%) | 반응형 브레이크포인트, aria-label, 시맨틱 태그, 터치 타겟 44px |
| E6 | Database Design (10%) | balance 관련 DynamoDB 테이블/인덱스 확인 (CDK Stack 참조) |
| E7 | Logging & Monitoring (5%) | console.log 프로덕션 잔존 여부, Lambda 로깅 |

**각 카테고리에서 FAIL이 나오면:**
- 지금 수정 가능한 건 → 수정
- balance 모듈 범위를 벗어나거나 비효율적인 건 → FAIL로 기록하고 다음 카테고리로 이동

### 3단계: 종합 보고서 작성

모든 카테고리 평가 완료 후, `HealEcho_Evaluation_Framework.md` 9.4 형식에 따라 종합 보고서를 작성합니다.

```
# Heal Echo 품질 평가 종합 보고서
평가 대상: wellness/balance 모듈
| Category | Weight | Score | Weighted |
| E1~E7 점수 기입 |
등급: A/B/C/D
Critical / Major / Minor Issues 목록
모바일 앱 연동 준비 상태
권장 액션 플랜
```

---

## 현재 파일 상태 요약

수정이 반영된 주요 파일 (이전 세션 결과):
- `src/types/balance.ts` — 신규 생성 (balance 공유 타입)
- `src/config/programs.ts` — `PROGRAM_ID` 상수 추가됨
- `src/app/wellness/balance/balance-brain.ts` — 중앙 타입 import, `UserSubscription` 사용
- `src/app/wellness/balance/player/player-brain.ts` — 중앙 타입 import, `any` 제거, 함수명/타입명 변경
- `src/app/wellness/balance/player/use-balance-player.ts` — `getValidUserInfo()` 사용, `PROGRAM_ID` 사용, `BalanceVideo` 타입 사용, `storage` import 제거
- `src/app/wellness/balance/page.tsx` — `PROGRAM_ID` 사용, `setSession` 사용
- `src/components/BottomTab.tsx` — `balance_hub_visited`를 `getSession`/`setSession`으로 변경
