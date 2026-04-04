CLAUDE.md를 참조하고, 아래 작업을 수행해줘.

# S-04: Home 페이지 경량화 (page.tsx 비즈니스 로직 분리)

## 왜 이 작업이 필요한가

Structural Convergence Rules의 Rule S-04는 page.tsx를 150줄 이하로 유지하도록 요구한다.
현재 `src/app/home/page.tsx`는 약 560줄이고, `src/app/home/pricing/page.tsx`는 약 330줄이다.

page.tsx에 "프로필 hydration", "구독 확인", "프로그램 선택 확인", "pending 재전송", "뒤로가기 방지" 등
여러 비즈니스 로직이 UI 코드와 섞여 있어서:
1. 한 로직을 수정할 때 다른 로직에 영향을 줄 위험이 있다
2. 향후 React Native에서 비즈니스 로직을 재사용할 수 없다 (M-04 위반)
3. 코드를 읽고 이해하기 어렵다

목표: page.tsx는 "화면을 어떻게 보여줄지"만 담당하고, 비즈니스 로직은 커스텀 훅으로 분리한다.

## 검수 대상 (2개 파일)

1. `src/app/home/page.tsx` (~560줄 → 목표 150줄 이하)
2. `src/app/home/pricing/page.tsx` (~330줄 → 목표 150줄 이하)

## 무엇을 어떻게 해야 하는가

### 1단계: page.tsx 분석 (코드 읽기만, 수정하지 않기)

먼저 page.tsx를 읽고, 아래 영역별로 줄 수와 의존성을 정리해줘:

| 영역 | 설명 | 의존하는 state/함수 |
|------|------|-------------------|
| 프로필 hydration | checkProfileSetup(), retryPendingProfileSync() | router, storage, getUserInfo, USER_API |
| 구독 확인 | refreshSubscriptions(), findSubscribed() | PROGRAMS_LIST, getSubscription/Sync |
| 프로그램 선택 | refreshConfirmedProgram(), navigateIfConfirmed() | getSelectedProgram, isSelectionConfirmed, PROGRAMS |
| pending 재전송 | onAppResume/onNetworkRestore → retryAll | retryPendingProfileSync/Program/Subscription |
| 뒤로가기 방지 | popstate 이벤트 핸들러 | — |
| UI 렌더링 | JSX return문 | 위 모든 state |

### 2단계: 커스텀 훅 설계

위 분석을 바탕으로 아래 훅들을 설계해줘.
훅 이름과 구조는 아래를 참고하되, 분석 결과에 따라 조정 가능:

**src/app/home/use-home-init.ts** (새 파일)
- 프로필 hydration (checkProfileSetup)
- retryPendingProfileSync (모듈 레벨 함수 — 훅 밖에 유지)
- pending 재전송 (onAppResume/onNetworkRestore)
- 뒤로가기 방지
- 반환값: `{ isReady: boolean }` 또는 필요한 최소 상태

**src/app/home/use-home-subscription.ts** (새 파일)
- 구독 상태 확인 (캐시 → 서버 2단계)
- 프로그램 선택 confirmed 상태
- 반환값: `{ subscribedProgram, confirmedProgram, isSubLoaded }`

**src/app/home/use-home-navigation.ts** (새 파일)
- navigateIfConfirmed()
- handleOpenModal()
- handleCloseModal()
- highlight=wellness 처리
- 반환값: `{ isModalOpen, isHighlightWellness, handleOpenModal, handleCloseModal }`

pricing/page.tsx도 동일하게:

**src/app/home/pricing/use-pricing-billing.ts** (새 파일)
- handleSelectProgram() (Toss SDK 연동 로직 전체)
- 반환값: `{ isLoading, errorMessage, handleSelectProgram }`

### 3단계: 훅 구현 + page.tsx 수정

- 훅을 하나씩 구현하고, page.tsx에서 해당 영역을 훅 호출로 교체
- **한 번에 하나의 훅만** 구현 → page.tsx 수정 → TypeScript 에러 확인 (`npx tsc --noEmit`)
- 훅 구현 순서: use-home-init → use-home-subscription → use-home-navigation → use-pricing-billing

### 4단계: 최종 확인

- `npx tsc --noEmit` 에러 없음 확인
- page.tsx가 150줄 이하인지 확인
- pricing/page.tsx가 150줄 이하인지 확인

## 예상 위험과 대응 방법

### 위험 1: 프로필 hydration 순서 변경 (가장 중요)

**문제:** checkProfileSetup()은 "로그인 확인 → storage 체크 → AWS 조회 → hydrate → refreshConfirmedProgram()" 순서로 실행된다. 이 순서가 바뀌면 기존 사용자(시나리오 B: AWS에 데이터 있지만 빈 로컬스토리지)가 프로필 설정 페이지로 잘못 보내질 수 있다.

**대응:**
- useEffect 내부의 실행 순서를 절대 변경하지 말 것
- checkProfileSetup()의 로직을 그대로 훅으로 옮기되, 조건 분기와 early return을 동일하게 유지
- hydration 완료 후 refreshConfirmedProgram()이 반드시 호출되는지 확인
- 특히 `if (!isUserLoggedIn()) { router.replace("/public/login"); return; }` 이 가드가 반드시 첫 번째로 실행되어야 함

### 위험 2: retryPendingProfileSync의 모듈 레벨 상태

**문제:** `syncInProgress` 변수가 모듈 레벨(컴포넌트 바깥)에 선언되어 중복 실행을 방지한다. 이걸 훅 안으로 옮기면 컴포넌트가 리렌더될 때마다 초기화될 수 있다.

**대응:**
- `retryPendingProfileSync` 함수와 `syncInProgress` 변수는 **훅 파일의 모듈 레벨에 유지** (훅 함수 바깥에 선언)
- useRef로 대체하지 말 것 — 현재 패턴이 의도적이고 안전함

### 위험 3: refreshConfirmedProgram이 setState를 호출

**문제:** refreshConfirmedProgram()은 `setConfirmedProgram()`을 호출한다. 이 함수가 checkProfileSetup() 안에서도 호출되고, 구독 확인(refreshSubscriptions) 안에서도 호출된다. 훅으로 분리하면 이 setState가 다른 훅의 관할이 되어 접근할 수 없을 수 있다.

**대응:**
- `confirmedProgram` 상태와 `refreshConfirmedProgram()` 함수를 `use-home-subscription` 훅에 포함시킨다
- `use-home-init`에서 hydration 완료 시 `refreshConfirmedProgram()`을 호출해야 하므로, 이 함수를 use-home-subscription에서 반환하고 use-home-init에 콜백으로 전달하거나, page.tsx에서 연결한다
- 가장 안전한 패턴: use-home-init이 `isReady` 플래그를 반환 → page.tsx의 useEffect에서 `isReady`가 true가 되면 `refreshConfirmedProgram()` 호출

### 위험 4: pricing/page.tsx의 window.location.origin

**문제:** handleSelectProgram 안에서 `window.location.origin`을 사용하여 Toss 콜백 URL을 생성한다. 훅으로 옮겨도 클라이언트 사이드이므로 문제없지만, SSR 환경에서 실수로 서버에서 실행되면 에러가 발생한다.

**대응:**
- 훅 파일에 "use client" 지시자를 반드시 포함
- handleSelectProgram은 사용자 클릭 이벤트에서만 호출되므로 SSR 위험은 실질적으로 없지만, 방어적으로 `typeof window !== "undefined"` 체크 유지

## 절대 하지 말 것 (CLAUDE.md 변경 안전 규칙)

1. profileSetupDone을 false로 설정하거나 리셋하는 코드를 작성하지 마
2. 요청하지 않은 가드, 리다이렉트, UI 변경을 추가하지 마
3. hydration 흐름의 조건 분기를 변경하지 마
4. 기존에 없던 새로운 상태(state)를 추가하지 마 (분리만 할 것)
5. 기능 동작을 변경하지 마 — 이 작업은 순수 리팩토링임

## 완료 기준

- [ ] page.tsx ≤ 150줄
- [ ] pricing/page.tsx ≤ 150줄
- [ ] `npx tsc --noEmit` 에러 없음
- [ ] 새로 만든 훅 파일명이 kebab-case (use-home-init.ts, 등)
- [ ] profileSetupDone을 false로 설정하는 코드 없음
- [ ] 시나리오 A(신규 사용자)와 시나리오 B(기존 사용자 + 빈 로컬스토리지)에서 동작이 수정 전과 동일
- [ ] 두 개념 분리 유지: profileSetupDone ≠ program_confirmed

## 작업 후 검증

모든 수정이 끝난 후 아래를 확인해줘:
1. 수정된 코드에서 profileSetupDone을 false로 설정하는 곳이 없는지 grep 확인
2. 시나리오 B의 hydration 흐름을 use-home-init에서 추적하여 기존과 동일한지 확인
3. 최종 줄 수 보고 (page.tsx, pricing/page.tsx, 각 훅 파일)
