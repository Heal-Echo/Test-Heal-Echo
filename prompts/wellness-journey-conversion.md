# 웰니스 솔루션 고객 여정 & 유료 전환 설계

> **이전 작업에서 완료된 분석과 설계를 기반으로 구현을 진행하는 프롬프트입니다.**
> 반드시 `HealEcho_Structural_Convergence_Rules.md`와 `CLAUDE.md`를 함께 참조하세요.

---

## 1. 이전 작업에서 이미 완료된 코드 변경 (2건)

### 1-1. Home `?highlight=wellness` 팝업 차단 (완료)

**파일:** `src/app/home/page.tsx` (272~289행 부근)

- **변경 전:** `?highlight=wellness`로 진입 시 무조건 `ProgramSelectModal` 열림
- **변경 후:** `getSelectedProgram()` + `isSelectionConfirmed()` 체크 → 확정 고객은 모달 없이 선택한 프로그램 route로 바로 이동, 미확정 고객만 모달 열기
- **이유:** BottomTab yoga 탭 → 안내 모달 → `/home?highlight=wellness` 체인에서, 이미 선택을 완료한 고객에게 다시 팝업이 뜨는 버그 수정

### 1-2. ProgramSelectModal 확인 메시지 추가 (완료)

**파일:** `src/app/home/ProgramSelectModal.tsx`

- **변경 전:** autobalance 카드 클릭 → 즉시 `syncProgramSelection` + `onClose` + `router.push`
- **변경 후:** autobalance 카드 클릭 → `syncProgramSelection` → `confirming` 상태 전환 → "기적의 오토 밸런스, 무료 체험을 시작합니다." 메시지 1.5초 표시 → 이동
- **구현 방식:** `useState(confirming)` → `if (confirming)` 분기로 모달 내용 전환, ESC/overlay 클릭 비활성

---

## 2. 고객이 솔루션을 선택할 수 있는 모든 진입점 (5곳)

| # | 진입점 | 파일 | 선택 완료 후 팝업 차단 |
|---|--------|------|----------------------|
| 1 | Home **마이 솔루션 CTA** 버튼 | `home/page.tsx` `handleOpenModal` | 차단됨 (기존 구현) |
| 2 | Home **`?highlight=wellness`** | `home/page.tsx` useEffect | **차단됨 (이번 작업에서 수정 완료)** |
| 3 | **BottomTab yoga 탭** | `components/BottomTab.tsx` | 차단됨 (기존 구현) |
| 4 | **Pricing 페이지 CTA** | `home/pricing/page.tsx` | **의도적으로 차단하지 않음** — 유료 고객은 결제 전 솔루션을 다시 생각할 기회 필요 |
| 5 | Home **웰니스 그리드 카드** | `home/page.tsx` `<Link>` | 해당 없음 (팝업 아님, 직접 이동) |

---

## 3. 현재 시스템의 구독 상태 흐름

```
browser → browser_selected → free_trial → paid
                               ↓            ↓
                         free_stopped   paid_stopped
```

### 핵심 개념 분리 (CLAUDE.md 필수 준수)

- **`program_confirmed = true`** (syncProgramSelection 호출 시): 고객이 솔루션을 "선택"한 상태. 구독 상태는 여전히 `browser`.
- **`free_trial`**: Pricing에서 카드 등록 완료 후 전환되는 상태. 이때부터 7일 카운트 시작.
- 이 두 개념은 **완전히 다른 것**. 선택 = 무료 1주차 체험 가능. free_trial = 카드 등록 완료.

### 카드 등록 발생 경로 (현재 유일한 경로)

```
어딘가의 CTA 클릭 → /home/pricing → 프로그램 선택 팝업 → Toss requestBillingAuth → 카드 등록 → free_trial
```

**카드 등록은 자동 트리거되지 않음.** weekly-solution 시청이나 weekly-habit 사용으로는 카드 등록이 발생하지 않음.

---

## 4. 마이 솔루션 반영 문제 (미구현 — 구현 필요)

**현재 문제:** Home 마이 솔루션 섹션은 `free_trial`/`paid`만 표시. 모달에서 오토밸런스를 선택해도 (confirmed=true) 마이 솔루션은 여전히 CTA 버튼 상태.

**설계 방향:**

| 상태 | 마이 솔루션 표시 |
|---|---|
| 미선택 (`browser`, confirmed 없음) | CTA: "Heal Echo 무료 체험 시작하기" (현재와 동일) |
| **선택 완료** (`browser` + confirmed) | **선택한 프로그램 카드 + "1주차 무료 체험 중" 표시** (신규) |
| 카드 등록 완료 (`free_trial`) | 프로그램 카드 + "7일 무료 체험 중" (현재와 동일) |
| 유료 (`paid`) | 프로그램 카드 + "구독 중" (현재와 동일) |

**구현 위치:** `home/page.tsx` 397~459행의 마이 솔루션 섹션. `subscribedProgram` 로직 외에 `getSelectedProgram()` + `isSelectionConfirmed()` 분기 추가.

**핵심:** 기존 `subscribedProgram` 로직(free_trial/paid 체크)을 건드리지 않고, 그 앞에 confirmed 상태를 위한 새 분기를 추가하는 방식.

---

## 5. 1주차 영상 플레이어 3단계 점진적 CTA (미구현 — 핵심 구현)

**목적:** 1주차 영상 시청 중 카드 등록을 효과적으로 유도하여 유료 전환율을 높인다.

**대상 파일:** `src/app/wellness/solution/player/page.tsx`

**대상 고객:** `subType === "browser"` (카드 미등록 고객)만 해당. free_trial/paid 고객에게는 표시하지 않음.

### 1단계: 플로팅 배너 (영상 시작 후 20~30초)

```
┌─────────────────────────────────────┐
│  [영상 재생 중]                       │
│                                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 2주차부터 전체 열기 →         │    │  ← 하단 플로팅, 반투명
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

- 영상을 **가리지 않는** 작은 반투명 배너
- 탭하면 카드 등록 플로우, 무시하면 영상 계속 재생
- 5초 후 자동 페이드아웃 또는 스와이프로 닫기
- **심리 메커니즘: 단순 노출 효과** — "더 있구나"라는 인지만 심어줌

### 2단계: 2주차 예고 카드 (영상 40~50% 시점)

```
┌─────────────────────────────────────┐
│  [영상 재생 중 — 살짝 어두워짐]        │
│                                     │
│    ┌───────────────────────┐        │
│    │  다음 주 예고           │        │
│    │  [2주차 썸네일] 제목    │        │
│    │  7일 무료 체험으로 열기 →│        │
│    └───────────────────────┘        │
│                                     │
│           3초 후 자동 페이드아웃       │
└─────────────────────────────────────┘
```

- 영상 **일시정지하지 않음** — 오버레이로 3초간 표시 후 사라짐
- 2주차 썸네일과 제목을 보여줌 (현재 `thumbByWeek` 데이터 활용 가능 — solution/page.tsx에서 이미 로드하는 패턴 있음)
- **심리 메커니즘: Zeigarnik 효과** — 미완성 과제에 대한 기억이 더 강함
- 탭하면 카드 등록, 무시하면 영상 계속

### 3단계: 영상 종료 후 전체화면 CTA (기존 강화)

```
┌─────────────────────────────────────┐
│                                     │
│     이번 영상은 어떠셨나요?           │
│                                     │
│     [2주차 썸네일]  [3주차 썸네일]     │
│                                     │
│   2주차부터 계속하려면               │
│   카드를 등록하세요.                 │
│   7일 무료, 언제든 취소 가능         │
│                                     │
│   [ 카드 등록하고 계속하기 ]          │
│   나중에 할게요                      │
└─────────────────────────────────────┘
```

- 기존 `handleEnded`의 70% 트리거를 종료 시점으로 통합
- 2~3주차 썸네일을 구체적으로 보여줌
- **핵심 변경: 여기서 바로 Toss SDK 호출** — `/home/pricing` 경유 없이. 이미 program은 선택된 상태이므로 프로그램 재선택 불필요.
- **심리 메커니즘: 손실 회피** — "여기서 멈추면 아까움"

### 카드 등록 직접 호출 시 참고사항

현재 Toss SDK 호출은 `home/pricing/page.tsx`의 `handleSelectProgram()`에만 있음. 3단계에서 pricing 경유 없이 직접 호출하려면:
- `handleSelectProgram`의 핵심 로직 (Toss SDK 초기화 → `requestBillingAuth`) 을 재사용 가능한 함수로 분리하거나
- player 페이지에서 동일한 Toss SDK 호출 로직을 구현
- `successUrl`/`failUrl` 콜백은 기존 `/public/billing/callback`을 그대로 사용
- plan 선택(연간/월간)은 player에서는 기본값(연간)으로 처리하거나, 간단한 토글 제공

### CTA 노출 범위 변화

| 시청 구간 | 현재 CTA 노출 | 구현 후 CTA 노출 |
|---|---|---|
| 0~20% (이탈 ~30%) | 없음 | 없음 (너무 이른 CTA는 역효과) |
| 20~40% (이탈 ~25%) | 없음 | 1단계 플로팅 배너 |
| 40~70% (이탈 ~30%) | 없음 | 2단계 2주차 예고 |
| 70%~종료 (~15%) | 있음 | 3단계 전체화면 CTA (강화) |

---

## 6. 구현 우선순위

| 순위 | 작업 | 난이도 | 영향도 |
|---|---|---|---|
| 1 | 마이 솔루션에 선택 상태 반영 | 낮음 | 중 — 소유감 형성, 재방문 유도 |
| 2 | 3단계 CTA: 영상 종료 후 강화 (pricing 경유 제거) | 중 | 높 — 핵심 전환 포인트 |
| 3 | 1단계 CTA: 플로팅 배너 | 낮음 | 중 — 인지 씨앗 |
| 4 | 2단계 CTA: 2주차 예고 카드 | 중 | 높 — 욕구 생성 |

---

## 7. 절대 하지 말 것

- **프로필 셋업과 솔루션 선택을 섞지 말 것** (CLAUDE.md 핵심 규칙)
- **기존 텍스트를 수정하지 말 것** — 새 UI 요소만 추가
- **Pricing 페이지의 프로그램 선택 팝업을 제거하지 말 것** — 유료 결제 고객에게는 필요
- **영상을 강제 일시정지하지 말 것** — 1단계, 2단계 CTA는 오버레이만, 영상은 계속 재생
- **free_trial/paid 고객에게 CTA를 보여주지 말 것** — `subType === "browser"` 조건 필수
- **기존 70% 시청 기록 저장 로직을 건드리지 말 것** — `handleTimeUpdate`의 practice-record, watch-record 저장은 그대로 유지

---

## 8. 관련 파일 목록

| 파일 | 역할 |
|---|---|
| `src/app/home/page.tsx` | Home 페이지 — 마이 솔루션 섹션, ProgramSelectModal 호출 |
| `src/app/home/ProgramSelectModal.tsx` | 솔루션 선택 모달 (확인 메시지 포함) |
| `src/app/home/pricing/page.tsx` | Pricing 페이지 — Toss SDK 호출 로직 참조용 |
| `src/app/wellness/solution/player/page.tsx` | 1주차 영상 플레이어 — 3단계 CTA 구현 대상 |
| `src/app/wellness/solution/page.tsx` | 솔루션 메인 — 썸네일 로드 패턴 참조, 재방문 배너 |
| `src/app/wellness/balance/page.tsx` | 밸런스 허브 — 위클리 솔루션/해빗 진입점 |
| `src/lib/programSelection.ts` | 솔루션 선택 SSOT — getSelectedProgram, isSelectionConfirmed, syncProgramSelection |
| `src/auth/subscription.ts` | 구독 상태 — canPlayVideo, getSubscriptionSync |
| `src/config/programs.ts` | 프로그램 메타데이터 SSOT |
| `src/components/BottomTab.tsx` | 하단 탭 — yoga 탭 선택 분기 |
| `docs/Harness Coding/HealEcho_Structural_Convergence_Rules.md` | 구조적 수렴 규칙 |
