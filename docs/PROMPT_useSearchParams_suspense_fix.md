# useSearchParams() Suspense 바운더리 수정 작업

## 배경

빌드 타입 에러 해결 작업 후 `npm run build` 실행 시, TypeScript 타입 에러는 모두 해결되었으나 **Next.js 프리렌더링 단계**에서 새로운 에러가 발생합니다.

**에러 메시지:**
```
useSearchParams() should be wrapped in a suspense boundary at page "/home".
Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
```

**원인:**
Next.js 14 App Router에서 `useSearchParams()`를 사용하는 컴포넌트는 반드시 `<Suspense>` 바운더리로 감싸야 합니다. 정적 페이지 생성(SSG) 시 `useSearchParams()`는 클라이언트 전용 훅이므로, 서버에서 프리렌더링할 때 값을 알 수 없어 에러가 발생합니다.

## 수정 대상 페이지 (7개)

| # | 페이지 경로 | 파일 위치 |
|---|---|---|
| 1 | `/home` | `src/app/home/page.tsx` |
| 2 | `/mypage/settings/subscription/change-payment` | `src/app/mypage/settings/subscription/change-payment/page.tsx` |
| 3 | `/public/billing/callback` | `src/app/public/billing/callback/page.tsx` |
| 4 | `/wellness/balance/player` | `src/app/wellness/balance/player/page.tsx` |
| 5 | `/wellness/solution/player` | `src/app/wellness/solution/player/page.tsx` |
| 6 | `/wellness/solution/self-check` | `src/app/wellness/solution/self-check/page.tsx` |
| 7 | `/wellness/psqi` | `src/app/wellness/psqi/page.tsx` |

## 수정 패턴

각 페이지에서 `useSearchParams()`를 사용하는 컴포넌트를 `<Suspense>`로 감싸야 합니다.

### 패턴 A: 페이지 컴포넌트 자체에서 useSearchParams() 사용 시

**수정 전:**
```tsx
"use client";
import { useSearchParams } from "next/navigation";

export default function SomePage() {
  const searchParams = useSearchParams();
  // ...
}
```

**수정 후:**
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SomePageContent() {
  const searchParams = useSearchParams();
  // ... 기존 로직 전체
}

export default function SomePage() {
  return (
    <Suspense fallback={null}>
      <SomePageContent />
    </Suspense>
  );
}
```

### 패턴 B: 자식 컴포넌트에서 useSearchParams() 사용 시

**수정 후:**
```tsx
import { Suspense } from "react";
import ChildComponent from "./ChildComponent";

export default function SomePage() {
  return (
    <Suspense fallback={null}>
      <ChildComponent />
    </Suspense>
  );
}
```

## 수정 절차

1. 각 페이지 파일을 읽어서 `useSearchParams()` 사용 위치 파악
2. 페이지 자체에서 사용하는지(패턴 A), 자식 컴포넌트에서 사용하는지(패턴 B) 확인
3. 적절한 패턴으로 `<Suspense>` 바운더리 추가
4. 기존 기능/로직은 일절 변경하지 않음
5. 7개 페이지 모두 수정 후 `npm run build`로 빌드 성공 확인

## 주의사항

- `fallback={null}` 사용 (로딩 UI 불필요한 경우)
- 기존 로직, 상태, 렌더링 구조를 변경하지 않음
- `useSearchParams()` 외의 코드는 수정하지 않음
- 한 번에 한 페이지씩 작업하고 승인 후 다음 진행 (AI_CONTEXT.ini 규칙)

## 이전 세션에서 해결한 빌드 에러 (참고)

- ✅ `auth/exchange/route.ts` → `createAuthCode` 분리 (`exchange/store.ts`)
- ✅ `auth/state/route.ts` → `createOAuthState`/`verifyOAuthState` 분리 (`state/store.ts`)
- ✅ `src/types/video.ts` → 누락 타입 복원 (`ApiListResponse`, `Video`, `UploadInitResponse`, `VideoMetaUpdate`)
- ✅ `admin/(shell)/studio/page.tsx` → 미사용 파일 삭제
- ✅ `src/pages_backup/` → 백업 폴더 삭제
- ✅ `client.ts` → `createWeeklyHabitContent`의 `habitItems` optional 변경
