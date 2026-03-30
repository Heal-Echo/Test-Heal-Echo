# 구독 관리 페이지 작업 정리서

> 작성일: 2026-03-11
> 목적: 이전 세션 작업 내용 정리 및 다음 세션 핸드오프

---

## 1. 완료된 작업 요약

### 1-1. PSQI 흐름 분리 (weekly-habit 페이지)

**파일:** `src/app/wellness/weekly-habit/page.tsx`, `weeklyHabit.module.css`

- PSQI 완료자 / 스킵자 / 미검사자 3가지 분기 렌더링 완성
- **PSQI 스킵자**: `psqiSkipped && !existingPSQI` 조건으로 "지금 수면의 질 검사하기" 카드 표시 → 클릭 시 `/wellness/psqi`로 이동
- **PSQI 완료자**: PSQITest 컴포넌트에 `onViewResult` prop 추가 → miniScoreCard 클릭 시 `/wellness/psqi`(독립 결과 페이지)로 이동
- CSS: `.psqiSkippedCard`, `.psqiSkippedIcon`, `.psqiSkippedText`, `.psqiSkippedBtn` 스타일 추가 (보라색 그라데이션 카드)

### 1-2. PSQITest 버그 수정

**파일:** `src/components/weekly-habit/PSQITest.tsx`

- **문제**: standalone 모드(독립 PSQI 페이지)에서도 `loadConfig` useEffect가 `setStep(2)`를 호출하여, PSQI 완료자가 결과 페이지 대신 수면 기록/습관 추적기(step 2)를 보게 됨
- **수정**: `if (initialResult && !standalone) { setStep(2); }` 조건 추가
- **수정**: step 2 렌더링 조건에 `!standalone` 가드 추가

### 1-3. max-width 표준화 (720px)

| 페이지 | 파일 | 변경 |
|---|---|---|
| wellness/psqi | `psqi.module.css` | `.container` 480px → 720px |
| self-check | `selfcheck.module.css` | `.main` 480px → `.container` 720px |
| weekly-habit | 이미 720px | 변경 없음 |

### 1-4. 자율신경 자가 체크 독립 결과 페이지

**신규 생성:**
- `src/app/wellness/solution/self-check/result/page.tsx`
- `src/app/wellness/solution/self-check/result/selfcheckResult.module.css`

**변경:**
- `src/app/wellness/solution/page.tsx`
  - `showResultDetail` 상태 제거
  - 결과 상세 오버레이 JSX (~125줄) 제거
  - 결과 카드 전체를 클릭 가능하게 변경 → `/wellness/solution/self-check/result`로 이동
  - `role="button"`, `tabIndex={0}`, `onKeyDown` 접근성 처리
- `src/app/wellness/solution/balance.module.css`
  - `.selfCheckResultCard`: cursor, hover, flex, active transform 추가
  - `.resultCardArrow`: 우측 화살표 스타일 신규
  - `.resultCardScoreSection`: `flex: 1; min-width: 0;` 추가

**결과 페이지 구조:**
1. localStorage → AWS 하이드레이트 폴백으로 결과 로드
2. 결과 없으면 `/wellness/solution`으로 리다이렉트
3. 섹션 순서: 불균형 신호 강도 → 영역별 분석 → 아이콘 그리드 → 시작하기 → 희망 메시지 → 확인
4. "하루 15분 요가, 지금 시작하기" → `/wellness/solution`
5. "확인" → `router.back()`

### 1-5. Query Parameter 기반 컨텍스트 네비게이션

`?from=subscription` 패턴으로 구독 관리 페이지에서 진입한 사용자에게 맞춤 CTA를 제공합니다.

**자율신경 자가 체크 (`/wellness/solution/self-check?from=subscription`):**

| 파일 | 변경 내용 |
|---|---|
| `self-check/page.tsx` | `useSearchParams()`로 `from` 읽기, 콜백 3종 분기 처리 |
| `SelfCheckSurvey.tsx` | `primaryCtaText`, `secondaryCtaText` props 추가 |

- `handleSkip`: from=subscription → `router.back()` / 기본 → player 페이지
- `handleStartTrial`: from=subscription → 결과 페이지 / 기본 → pricing
- `handleWatchFirst`: from=subscription → 구독 관리 / 기본 → player 페이지
- CTA 텍스트: "나의 결과 자세히 보기" / "구독 관리로 돌아가기"

**PSQI 수면의 질 검사 (`/wellness/psqi?from=subscription`):**

| 파일 | 변경 내용 |
|---|---|
| `psqi/page.tsx` | `useSearchParams()`로 `from` 읽기, `handleNavigateToHabit`/`handleSkip` 분기 |
| `PSQITest.tsx` | `ctaText`, `skipText` props 추가 |

- `handleNavigateToHabit`: from=subscription → `/mypage/settings/subscription` / 기본 → `/wellness/weekly-habit`
- `handleSkip`: from=subscription → 구독 관리 (스킵 플래그 없이) / 기본 → 스킵 플래그 + weekly-habit
- CTA 텍스트: "구독 관리로 돌아가기" / "구독 관리로 돌아가기"

### 1-6. 구독 관리 페이지 "지금 검사하기" 링크

**파일:** `src/app/mypage/settings/subscription/page.tsx`, `subscription.module.css`

- 자율신경 자가 체크 미검사: "지금 검사하기" → `/wellness/solution/self-check?from=subscription`
- PSQI 미검사: "지금 검사하기" → `/wellness/psqi?from=subscription`
- CSS: `.ftDashboardCheckBtn` 스타일 (보라색 밑줄 링크, 12px, hover 효과)

---

## 2. 구독 관리 페이지 현재 구조

### 4-섹션 레이아웃 (free_trial 사용자)

```
┌─────────────────────────────────────┐
│  섹션 1: 구독 상태 카드               │
│  ┌──────────┐ ┌──────────┐          │
│  │ 불균형 신호│ │ 수면 품질  │          │
│  │ (자가체크) │ │ (PSQI)   │          │
│  └──────────┘ └──────────┘          │
│  ┌────────────────────────┐         │
│  │  WELLNESS CERTIFICATE  │         │
│  │   웰니스 실천일 배지      │         │
│  │   [물결 원 + 숫자]       │         │
│  │   프로그램 참여 태그       │         │
│  └────────────────────────┘         │
│  결제 정보 박스                       │
├─────────────────────────────────────┤
│  섹션 2: 나의 활동 요약               │
│  - 0일: 빈 상태 + "첫 솔루션 시작"    │
│  - 1일+: 참여/시청/연속 카드 + CTA    │
├─────────────────────────────────────┤
│  섹션 3: 곧 열리는 다음 여정           │
│  - 2주차 솔루션 (블러+잠금)           │
│  - 수면 분석 리포트 (잠금)             │
├─────────────────────────────────────┤
│  섹션 4: 체험 해지                    │
│  - 해지 안내 + "체험 해지하기" 버튼    │
└─────────────────────────────────────┘
```

### 각 섹션 구현 상태

| 섹션 | 상태 | 비고 |
|---|---|---|
| 섹션 1: 상태 카드 | ✅ 완료 | 불균형 신호, 수면 품질, 실천일 배지, 결제 정보 모두 구현 |
| 섹션 2: 나의 활동 | ✅ 완료 | 0일/1일+ 분기 처리 완료 |
| 섹션 3: 다음 여정 | ✅ 완료 | 2주차 썸네일 + 잠금 아이콘 |
| 섹션 4: 체험 해지 | ⚠️ 기본 완료 | 해지 플로우(`/cancel`)는 TODO |

### 웰니스 대시보드 데이터 소스

| 항목 | 데이터 소스 | API |
|---|---|---|
| 자율신경 자가 체크 | localStorage → AWS 하이드레이트 | `fetchAndHydrateSelfCheckResult()` |
| PSQI 수면 품질 | AWS API | `/api/user/psqi-result` |
| 웰니스 실천일 | AWS API | `/api/user/practice-record` |
| 결제 정보 | AWS API | `/api/user/billing/info?programId=autobalance` |
| 2주차 콘텐츠 | AWS API | `/api/public/balance/videos/autobalance` |

---

## 3. 수정/생성된 전체 파일 목록

### 수정된 파일
1. `src/app/wellness/weekly-habit/page.tsx` — PSQI 분기 렌더링
2. `src/app/wellness/weekly-habit/weeklyHabit.module.css` — psqiSkippedCard 스타일
3. `src/components/weekly-habit/PSQITest.tsx` — standalone 버그 수정, ctaText/skipText props
4. `src/app/wellness/psqi/page.tsx` — ?from=subscription 지원
5. `src/app/wellness/psqi/psqi.module.css` — max-width 720px
6. `src/app/wellness/solution/page.tsx` — 결과 오버레이 → 독립 페이지 전환
7. `src/app/wellness/solution/balance.module.css` — 결과 카드 클릭 스타일
8. `src/app/wellness/solution/self-check/page.tsx` — ?from=subscription 지원
9. `src/app/wellness/solution/self-check/selfcheck.module.css` — max-width 720px
10. `src/components/self-check/SelfCheckSurvey.tsx` — primaryCtaText/secondaryCtaText props
11. `src/app/mypage/settings/subscription/page.tsx` — "지금 검사하기" 버튼 추가
12. `src/app/mypage/settings/subscription/subscription.module.css` — ftDashboardCheckBtn 스타일

### 신규 생성된 파일
13. `src/app/wellness/solution/self-check/result/page.tsx` — 독립 결과 페이지
14. `src/app/wellness/solution/self-check/result/selfcheckResult.module.css` — 결과 페이지 스타일

---

## 4. 다음 세션에서 해야 할 일

### 4-1. 웰니스 실천일 1~4일 고객을 위한 Wellness Certificate 재설계

**현재 상태:** `ftAwardCard`는 단순히 전체 실천일 숫자와 프로그램 참여 태그만 표시합니다.

**문제:** 1~4일 초기 사용자에게 큰 숫자 "1", "2"만 보여주는 것은 동기부여 효과가 약합니다. 이 시기는 무료 체험 7일 중 가장 중요한 습관 형성 구간이므로, 작은 성취도 의미 있게 보여줘야 합니다.

**설계 방향 제안:**
- 1~4일 사용자에게 특화된 시각적 피드백 (예: 달성률 바, 일별 체크마크, 마일스톤 메시지)
- 각 날짜별 맞춤 격려 메시지 (1일: "첫 걸음", 2일: "연속 실천", 3일: "습관의 시작", 4일: "절반을 넘었어요")
- 7일 완주 목표 시각화
- 프로그램별(솔루션/해빗/이해의 바다) 실천 현황 상세 표시

**관련 참고 문서:**
- `docs/free-trial-user-types.md` — 5가지 사용자 유형과 구독 관리 페이지 방문 시점/목적
- `docs/localStorage-vs-AWS-data-map.md` — 데이터 저장 구조

### 4-2. 사용자 유형별 분기 로직 (Day 4+ 기준)

**현재 상태:** 구독 관리 페이지는 모든 free_trial 사용자에게 동일한 UI를 보여줍니다.

**미구현 아이디어:** `participationDays`와 `daysElapsed` 조합으로 사용자를 세분화하여, 각 유형에 맞는 메시지와 CTA를 제공할 수 있습니다.

| 조건 | 유형 | 적합한 메시지 |
|---|---|---|
| daysElapsed 0~1, participation 0 | 방금 등록 (유형 E) | 안심 정보 강조 |
| daysElapsed 3~5, participation 0 | 이탈 위험 (유형 B) | 재진입 유도 |
| daysElapsed 1~4, participation 1~4 | 초기 참여자 (유형 A) | 습관 형성 격려 |
| daysElapsed 5~7, participation 3+ | 전환 가능 (유형 A/C) | 유료 혜택 강조 |

### 4-3. 해지 플로우 구현

**현재 상태:** 섹션 4의 "체험 해지하기" 버튼은 `/mypage/settings/subscription/cancel`로 이동하지만, cancel 페이지는 아직 미구현(TODO) 상태입니다.

### 4-4. 기타 미완료 항목

- paid / paid_stopped / free_stopped 사용자를 위한 구독 관리 UI (현재 "준비 중" 텍스트만 표시)
- 구독 관리 페이지 max-width: 현재 480px (다른 웰니스 페이지는 720px로 통일됨 — 의도적 차이인지 확인 필요)

---

## 5. 핵심 설계 패턴 요약

### Query Parameter 패턴
```
/wellness/psqi?from=subscription
/wellness/solution/self-check?from=subscription
```
- 구독 관리에서 진입 → CTA가 "구독 관리로 돌아가기"로 변경
- 기본 진입 → CTA가 원래 흐름 유지 (weekly-habit, pricing 등)
- `useSearchParams().get("from")` === "subscription"으로 판별

### Standalone 모드 패턴
- PSQITest: `standalone` prop이 true면 독립 페이지, false면 weekly-habit 내장
- standalone 모드에서는 step 2(수면 기록/습관 추적기) 전환 차단

### 데이터 로딩 패턴
- localStorage로 빠른 UI 표시 → AWS API로 영속 데이터 하이드레이트
- 인증: `localStorage.getItem("user_id_token")`을 Bearer 토큰으로 사용
