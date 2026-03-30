# 작업 프롬프트: "나만의 웰니스 기록" 독립 페이지 구축

## 1. 궁극적인 목표

구독 관리 페이지(`/mypage/settings/subscription`)의 "기록 보기" CTA와 마이페이지(`/mypage`)에서 접근할 수 있는 **"나만의 웰니스 기록" 독립 페이지**(`/mypage/wellness-record`)를 설계하고 구현합니다.

이 페이지는 고객이 자신의 웰니스 실천 데이터를 종합적으로 확인하고, "나 잘하고 있구나"라는 자기효능감을 얻는 **보상 공간**입니다.

---

## 2. 지금까지의 작업 플로우 (이전 대화 요약)

### 2-1. 구독 관리 페이지 CTA 분석 완료

구독 관리 페이지의 CTA는 3가지 유형으로 분류됩니다:

**"시작하기" 계열 (→ `/wellness/solution` 직행, 변경 없음)**
- "첫 번째 솔루션 시작하기"
- "오늘의 솔루션 시작하기"
- "솔루션 경험해보기"

**"기록 보기" 계열 (→ `/mypage/wellness-record`로 변경 필요)**
- "오늘의 기록 확인하기" — 첫 실천 직후 (participation=1)
- "나의 실천 기록 보기" — 연속 2~3일 또는 복귀 실천
- "나의 웰니스 기록 보기" — 연속 4일+ 장기 실천자

이 3개 CTA는 모두 `practicedToday === true`인 고객에게만 표시됩니다.

### 2-2. 전문가 분석 결론

4명의 전문가(인지행동심리, 고객심리, 마케팅, UI/UX)가 공통으로 합의한 설계:
- "기록 보기" CTA는 **독립 페이지**(`/mypage/wellness-record`)로 이동
- 스크롤/아코디언 방식은 구독 관리 페이지를 비대하게 만들고 역할 혼란 야기
- 독립 페이지는 "나만의 기록 공간"이라는 보상감 제공

### 2-3. 진입점 설계 확정

| 우선순위 | 위치 | 역할 |
|---|---|---|
| 1순위 | 마이페이지 대시보드 하단 버튼 | 의도적 탐색 (내가 보고 싶을 때) |
| 2순위 | 구독 관리 페이지 "기록 보기" CTA | 상황적 트리거 (실천 후 동기부여) |
| 3순위 | (향후) 솔루션 영상 시청 완료 후 | 실천 직후 보상 루프 |

### 2-4. 마이페이지 현재 구조

마이페이지(`/mypage`)에 이미 존재하는 요소:
- 나의 실천 기록 (통합 달력, 3색 도트: 솔루션/해빗/이해의 바다)
- 자율신경 밸런스 추이 (최근 6회 트렌드 차트)
- 수면 품질 추이 (최근 6회 트렌드 차트)

이들은 **요약 스냅샷** 역할이고, 새 독립 페이지는 **전체 히스토리와 상세 분석** 역할입니다.

### 2-5. 기존 코드 변경 사항

- `wellness/solution/page.tsx`에서 프로그램 선택 모달 삭제 완료 (프로그램 선택은 /home에서)
- ComingSoonModal, PROGRAMS_LIST, Image import 정리 완료
- 팝업 오버레이가 BottomTab(z-index:9999)을 덮도록 정리 완료 (selfCheckOverlay z-index:10010)

---

## 3. 새 작업에서 해야 할 일

### Phase 1: 설계 확인

1. **AI_CONTEXT.ini 읽기** — 프로젝트 컨벤션 확인
2. **데이터 소스 확인** — 아래 API들이 실제로 동작하는지 검증

### Phase 2: 독립 페이지 구현 (`/mypage/wellness-record`)

**경로**: `src/app/mypage/wellness-record/page.tsx`

**10가지 섹션 (위에서 아래 순서)**:

```
❶ 종합 웰니스 스코어
   - 3가지 축(밸런스/수면/실천)의 방사형 차트 또는 단일 종합 점수
   - 데이터: selfcheck intensity + PSQI score + practice days → 가중 평균

❷ 변화 하이라이트 (Before → After)
   - 첫 자가체크 vs 최근 자가체크 비교
   - 첫 PSQI vs 최근 PSQI 비교
   - 데이터: selfcheck-result 배열 첫번째/마지막, psqi-result 배열 첫번째/마지막

❸ 주간 리포트 카드
   - 이번 주 실천 요약: 솔루션 N회, 해빗 N회, 이해의 바다 N회, 평균 수면 N시간
   - 데이터: practice-record + sleep-log → 프론트엔드 집계

❹ 통합 실천 달력
   - 하나의 달력에 3종 실천을 색상 도트로 구분 표시
   - ● 솔루션(파랑) ● 해빗(초록) ● 이해의바다(보라)
   - 데이터: GET /api/user/practice-record (전체 타입)

❺ 자율신경 밸런스 추이
   - 측정 시점별 % 꺾은선 그래프
   - 향후 우먼즈 컨디션 케어 추가 영역 확보
   - 데이터: GET /api/user/selfcheck-result

❻ 수면 품질 추이
   - 12개월 PSQI 점수 트렌드
   - 데이터: GET /api/user/psqi-result

❼ 수면 상세 그래프
   - 월간 취침-기상 패턴 차트 + 수면 시간 추이선
   - 데이터: GET /api/user/sleep-log?startDate=&endDate=
   - 참고: /mypage/sleep-history에 이미 SVG 차트 구현체 존재 (재활용 가능)

❽ 위클리 솔루션 실천 현황
   - 주차별 시청 완료 현황, 현재 N주차, 총 M일 실천
   - 데이터: practice-record (type=solution) + subscription 정보

❾ 식습관 실천 그래프
   - 월간 습관 체크 스택 바 차트
   - 데이터: GET /api/user/habit-tracking/{weekNumber}
   - 참고: /mypage/sleep-history에 습관 차트 구현체 존재

❿ 이해의 바다 실천 현황
   - 세션별 이용 횟수, 총 명상 시간
   - 데이터: practice-record (type=understanding)
```

### Phase 3: CTA 연결

1. **구독 관리 페이지** (`/mypage/settings/subscription/page.tsx`)
   - "기록 보기" 계열 CTA 3개의 onClick을 `/mypage/wellness-record`로 변경
   - 해당 CTA: "오늘의 기록 확인하기", "나의 실천 기록 보기", "나의 웰니스 기록 보기"
   - 현재 모두 `router.push("/wellness/solution")`으로 되어 있음
   - 3개 CTA 모두 동일하게 `/mypage/wellness-record` 페이지 최상단으로 이동
   - (3개 CTA는 조건에 따라 하나만 표시되므로 앵커 차별화 불필요)

2. **마이페이지** (`/mypage/page.tsx`)
   - 수면 품질 추이 섹션 아래에 "나만의 웰니스 기록 전체 보기" 버튼 추가
   - 구독 관리 페이지의 CTA 버튼(`ftSolutionBtn`)과 동일한 스타일 (화살표 포함)

---

## 4. 사용 가능한 API 데이터 소스

| API | 메서드 | 용도 | 이력 지원 |
|---|---|---|---|
| `/api/user/selfcheck-result` | GET/POST | 자율신경 자가체크 결과 | ✅ 배열 |
| `/api/user/psqi-result` | GET/POST | 수면 품질 PSQI 결과 | ✅ 배열 |
| `/api/user/practice-record` | GET/POST | 실천 기록 (solution/habit/understanding) | ✅ 일별 |
| `/api/user/sleep-log` | GET/POST | 수면 상세 기록 (취침/기상/각성 등) | ✅ 일별 |
| `/api/user/habit-tracking/{week}` | GET/POST | 주간 습관 체크 기록 | ✅ 주별 |
| `/api/user/subscription` | GET | 구독 상태 (주차, 시작일 등) | - |

---

## 5. 참고 파일

| 파일 | 참고 내용 |
|---|---|
| `src/app/mypage/page.tsx` | 마이페이지 대시보드 (달력, 추이 차트 패턴) |
| `src/app/mypage/sleep-history/page.tsx` | SVG 차트 구현체 (수면 패턴, 습관 바 차트, PSQI 트렌드) |
| `src/app/mypage/settings/subscription/page.tsx` | CTA 연결 변경 대상 |
| `src/components/self-check/SelfCheckSurvey.tsx` | 자가체크 데이터 구조, getSignalIntensity, getSignalGrade |
| `src/app/wellness/solution/page.tsx` | 실천 달력 패턴 참고 |
| `src/auth/subscription.ts` | getBalanceUserState, getCompletedDates 등 유틸 |

---

## 6. 설계 원칙

- **위에서 아래로 "종합 → 상세"**: 최상단에서 즉각적 보상감, 아래로 갈수록 세부 데이터
- **데이터 없는 섹션 처리**: 미검사/미실천 상태에서는 빈 상태 카드 + 해당 검사/실천으로 안내하는 CTA
- **기존 SVG 차트 재활용**: sleep-history의 차트 패턴을 기반으로 일관된 시각 언어
- **모바일 우선**: 모든 차트/그래프는 모바일 뷰포트(375px)에서 가독성 확보
- **영상 70% 시청 시 실천 기록**: solution 영상 70% 이상 시청 = 실천 완료 (practice-record POST)
