# 4주 완성 선물 영상 빌드 — 사전 체크리스트

> **Version:** 1.0
> **Date:** 2026-04-05
> **Target:** `/src/app/wellness/solution/player/` 내 선물 영상 재생 기능
> **Purpose:** 선물 영상 빌드 전, Harness Coding 규칙 준수를 위해 확인·보완해야 할 항목 정리
> **Usage:** 이 문서를 기반으로 선물 영상 빌드용 Harness Rule을 생성할 때 참고

---

## 0. 현재 상태 요약

### 이미 구축된 부분
| 레이어 | 파일 | 역할 |
|--------|------|------|
| **타입** | `/src/types/subscription.ts` | `GiftCycle` 타입 정의 (qualifiedWeeks, giftUnlockedAt, giftExpiresAt, giftVideoId 등) |
| **비즈니스 로직** | `/src/auth/subscription.ts` | `isGiftAccessible()`, `getGiftProgressMessage()`, `countQualifyingWeeksRolling()`, `fetchGiftCycleFromServer()`, `saveGiftCycle()` |
| **API Route** | `/src/app/api/user/gift-cycles/route.ts` | GET/POST 프록시 (Lambda로 중계) |
| **Lambda** | `/healecho-infra/lambda/user-gift-cycle.ts` | 선물 사이클 조회/저장, 다중 기기 충돌 방지 로직 |
| **DB** | DynamoDB `GiftCyclesTable` | PK: userId, SK: cycleKey (programId#cycleNumber) |
| **UI (부분)** | `/src/app/wellness/solution/page.tsx` | 선물 진행 카드 표시 (🎁 선물 뱃지, 진행 메시지) |

### 아직 없는 부분
| 항목 | 설명 |
|------|------|
| **선물 영상 재생 UI** | player 페이지에서 선물 영상을 실제로 재생하는 컴포넌트가 없음 |
| **선물 영상 전용 컴포넌트** | `/src/components/` 아래에 선물 관련 컴포넌트 폴더 없음 |

---

## 1. 타입 정의 확인 — Rule D-01

**확인 사항:** 선물 "영상" 자체의 타입이 `/src/types/video.ts`에 정의되어 있는가?

- `GiftCycle` 타입은 선물 사이클의 **상태**를 관리 (subscription.ts에 존재)
- 선물 영상의 **콘텐츠 데이터** (영상 URL, 제목, 재생 시간, 썸네일 등)에 대한 타입이 `/src/types/video.ts`에 있는지 확인 필요
- 일반 영상(`Video`, `PlayerVideo`)과 선물 영상의 구분이 타입 레벨에서 되어야 함

**관련 Harness Rule:** D-01 (타입 정의 중앙화)

---

## 2. Config 설정값 확인 — Rule D-03, M-05

**확인 사항:** 선물 영상 ID/설정이 `/src/config/`에 있는가?

- 선물 영상 ID를 코드에 직접 쓰면(하드코딩) 영상 교체 시 코드를 수정해야 함
- `/src/config/` 아래에 선물 영상 관련 설정 파일이 있거나, 기존 설정 파일에 포함되어 있어야 함
- 선물 영상 열람 기간(현재 7일), 선물 해금 조건(4주, 주당 3일) 같은 매직넘버도 config로 관리해야 함

**관련 Harness Rule:** D-03 (프로그램 메타데이터 SSOT), M-05 (하드코딩 금지)

---

## 3. Page 컴포넌트 경량화 — Rule S-04 (선행 과제)

**현재 문제:** `player/page.tsx`가 약 26,000바이트(약 700줄 이상)로 150줄 제한을 심각하게 초과

- 선물 영상 기능 추가 전에 기존 page.tsx 리팩토링이 선행되어야 함
- 비즈니스 로직, 상태 관리, 복잡한 UI를 별도 컴포넌트/훅으로 분리 필요
- 리팩토링 없이 기능을 추가하면 이후 정리 비용이 크게 증가

**관련 Harness Rule:** S-04 (Page 컴포넌트 경량 유지, 150줄 이하)

**권장 조치:** 선물 영상 빌드 전에 player/page.tsx 리팩토링을 별도 작업으로 먼저 진행

---

## 4. 컴포넌트 분리 — Rule S-02

**확인 사항:** 선물 영상 플레이어를 어디에 만들 것인가?

- player/page.tsx 안에 직접 구현하면 안 됨 (S-04 위반)
- `/src/components/gift/` 같은 도메인별 폴더로 분리해야 함
- 선물 영상에 필요한 컴포넌트 후보:
  - 선물 영상 플레이어 (재생 UI)
  - 선물 해금 안내 (잠금 상태일 때 표시)
  - 선물 만료 알림 (7일 기한 카운트다운)

**관련 Harness Rule:** S-02 (컴포넌트 기능별 폴더 분리)

---

## 5. 도메인 모델 문서 보완 — Structural Convergence Rules 3.1

**현재 문제:** Reward 도메인에 `GiftCycle` Entity만 기재되어 있고, 선물 영상의 접근 규칙이 문서에 명시되지 않음

**문서에 추가해야 할 비즈니스 규칙:**

| 항목 | 규칙 |
|------|------|
| **해금 조건** | paid 구독자가 4주 동안 매주 최소 3일 이상 시청 완료 |
| **대상 자격** | paid 구독자만 가능. free_trial은 연습만 가능, 선물 해금 불가 |
| **열람 기간** | 해금 후 7일간 접근 가능 (`giftUnlockedAt` + 7일) |
| **만료 후** | 사이클 종료, qualifiedWeeks 리셋, 다음 사이클 시작 |
| **사이클 반복** | Cycle 1 (4주) → 선물 1 → Cycle 2 (4주) → 선물 2 → 반복 |
| **다중 기기** | 서버 기준으로 충돌 방지 (max qualifiedWeeks 로직) |

**관련 위치:** `HealEcho_Structural_Convergence_Rules.md` → 3.1 핵심 도메인 → Reward 항목

---

## 6. 데이터 흐름 설계 — Rule DF-01

**선물 영상 재생 시 예상 데이터 흐름:**

```
[Player Page]
    │
    ├─ 1. isGiftAccessible() 호출 → 선물 접근 가능 여부 확인
    │     (giftUnlockedAt 존재 + 7일 이내)
    │
    ├─ 2. giftVideoId로 영상 데이터 조회
    │     Component → API Route → Lambda → DynamoDB/S3
    │
    ├─ 3. 영상 URL 수신 (S3 presigned URL 또는 CloudFront URL)
    │
    └─ 4. 선물 영상 플레이어 컴포넌트에 데이터 전달 → 재생
```

**확인 사항:**
- 역방향 데이터 전달 없이 단방향으로 설계되어 있는가?
- 영상 URL은 S3/CloudFront를 통해 제공되는가? (서버 로컬 저장 금지 — Rule M-03)
- localStorage 캐시는 AWS와 동기화되는가? (Rule DF-02)

---

## 7. 빌드 전 실행 순서 (권장)

```
Step 1: 타입 확인/보완
    └─ /src/types/video.ts에 선물 영상 타입 확인
    └─ 필요시 추가 (D-01)

Step 2: Config 확인/보완
    └─ 선물 영상 설정값(ID, 열람 기간, 해금 조건)이 config에 있는지 확인
    └─ 필요시 추가 (D-03, M-05)

Step 3: page.tsx 리팩토링 (선행 과제)
    └─ 기존 player/page.tsx를 150줄 이하로 분리 (S-04)
    └─ 비즈니스 로직 → 훅/lib으로 추출
    └─ 복잡한 UI → 별도 컴포넌트로 분리

Step 4: 선물 영상 컴포넌트 생성
    └─ /src/components/gift/ 폴더 생성 (S-02)
    └─ 선물 영상 플레이어 컴포넌트 구현

Step 5: Player Page에 선물 영상 연결
    └─ page.tsx에서 선물 컴포넌트 import + 조건부 렌더링

Step 6: Harness 검증
    └─ 네이밍 → 구조 → 도메인 → API → 데이터 흐름 순서로 V-M-V 실행
```

---

## 8. 관련 Harness Rule 매핑

| 체크 항목 | 관련 Harness Rule |
|-----------|------------------|
| 선물 영상 타입 중앙화 | D-01 (타입 정의 중앙화) |
| 선물 영상 설정값 config 관리 | D-03 (프로그램 메타데이터 SSOT), M-05 (하드코딩 금지) |
| page.tsx 경량화 | S-04 (Page 컴포넌트 150줄 이하) |
| 선물 컴포넌트 폴더 분리 | S-02 (컴포넌트 기능별 폴더 분리) |
| 파일명 kebab-case | N-01 (파일명 kebab-case) |
| 컴포넌트 PascalCase export | N-02 (컴포넌트 export PascalCase) |
| 데이터 단방향 흐름 | DF-01 (단방향 데이터 흐름) |
| localStorage는 캐시 용도만 | DF-02 (localStorage는 캐시일 뿐) |
| API Route 순수 Proxy | A-01 (API Route는 순수 Proxy) |
| JWT 인증 전용 | A-04 (플랫폼 비종속 설계), M-02 (인증 JWT 전용) |
| 파일 업로드 S3 전용 | M-03 (파일 업로드 S3 전용) |
