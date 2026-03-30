# 로그인 페이지 최적화 — 이어서 진행

## 1. 궁극적인 목적

`public/login` 페이지를 데스크탑 웹, 태블릿 웹, 모바일 웹에서 최적으로 동작하도록 반응형 + 성능 최적화하는 작업입니다. 향후 모바일 앱 전환을 고려한 장기적 관점의 설계입니다.

---

## 2. 지금까지 완료한 작업

### 반응형 + 성능 최적화 (9단계 완료)

| 단계 | 내용 | 상태 |
|------|------|------|
| 1 | 브레이크포인트 통일 (480px / 768px) — landing, globals.css와 일치 | ✅ |
| 2 | clamp()로 유동 타이포그래피/간격 적용 (bigTitle, subtitleFrame, emailInput, continueButton, rightFrameContainer) | ✅ |
| 3 | 좌우 패널 높이 동기화 — mainContent `align-items: stretch` + loginPage `align-items: flex-start` | ✅ |
| 4 | 모바일 단일 컬럼 전환 + safe-area-inset 적용 | ✅ |
| 5 | 태블릿 (769–1024px) 좌측 패널 38% 조정 | ✅ |
| 6 | 터치 디바이스 hover 고정 방지 — `@media (hover: none)` | ✅ |
| 7 | 접근성 — `@media (prefers-reduced-motion: reduce)` 애니메이션 비활성화 | ✅ |
| 8 | 이미지 최적화 — Next.js `<Image>` + WebP (PNG 17.5MB → WebP 77KB) | ✅ |
| 9 | 모바일 키보드 대응 — 100dvh, scroll-margin-bottom | ✅ |

### 추가 작업 (4개 완료)

| 추가 | 내용 | 상태 |
|------|------|------|
| 1 | 로그인/회원가입 버튼 글자색 → `color: #000` 명시 | ✅ |
| 2 | 모바일 헤더-폼 간격 축소 — `margin-top: 64px` → `8px` (sticky 헤더 보상) | ✅ |
| 3 | 비밀번호 규칙 포커스 시 표시 + 모두 충족 시 0.5초 후 페이드아웃 | ✅ |
| 4 | 비밀번호 확인란 추가 + 불일치 시 빨간 테두리/메시지 + 제출 차단 | ✅ |

### 빌드 에러 수정 (부분 완료)

| 에러 | 파일 | 원인 | 조치 | 상태 |
|------|------|------|------|------|
| `components/Studio` 못 찾음 | `admin/(shell)/studio/page.tsx` | 경로 불일치 | `components/adminStudio/Studio`로 수정 | ✅ |
| `createAuthCode` 잘못된 Route export | `api/public/auth/exchange/route.ts` | Route Handler에서 비-HTTP 함수 export | `store.ts`로 분리, 4개 콜백 import 경로 변경 | ✅ |
| `createOAuthState` 잘못된 Route export | `api/public/auth/state/route.ts` | 동일한 패턴의 에러 | **미해결** | ❌ |

### 추가 수정 사항

- 모바일 가로 스크롤 수정: 768px 미디어쿼리에서 `.mainContent` `padding: 0`, `.loginPage`에 `overflow-x: hidden` 추가
- 데스크탑 세로 여백 축소: `.mainContent` 상단 패딩 제거, `.rightFrame` 상하 패딩 제거, `.rightFrameContainer` 패딩/gap 축소

---

## 3. 현재 에러 설명

```
src/app/api/public/auth/state/route.ts
Type error: Route "src/app/api/public/auth/state/route.ts" does not match
the required types of a Next.js Route.
"createOAuthState" is not a valid Route export field.
```

**원인:** `exchange/route.ts`에서 `createAuthCode`를 분리한 것과 동일한 패턴입니다. `state/route.ts`에서도 `createOAuthState`라는 유틸리티 함수를 export하고 있는데, Next.js Route Handler 파일은 HTTP 메서드(`GET`, `POST` 등)만 export할 수 있습니다.

**해결 방법:** `exchange` 때와 동일하게 처리합니다:
1. `src/app/api/public/auth/state/store.ts` (또는 적절한 이름) 파일을 생성
2. `createOAuthState` 함수와 관련 저장소/타입을 `store.ts`로 이동
3. `state/route.ts`에서는 HTTP 핸들러만 남기고 `store.ts`에서 import
4. `createOAuthState`를 import하는 다른 파일들의 경로를 `store.ts`로 변경

---

## 4. 새 작업에서 해야 할 일

### 4-1. 빌드 에러 해결 (우선)
- `src/app/api/public/auth/state/route.ts`의 `createOAuthState` 분리
- `npm run build` 실행하여 빌드 성공 확인
- 추가 에러가 있으면 동일한 패턴으로 해결

### 4-2. 시각 검증 (10단계)
- 브라우저 개발자 도구에서 360px / 480px / 768px / 1024px 뷰포트 확인
- 로그인 뷰, 회원가입 뷰 각각 검증
- 레이아웃 깨짐, 텍스트 잘림, 터치 영역 문제 등 확인

---

## 5. 주요 파일 위치

- 로그인 페이지 컴포넌트: `src/app/public/login/page.tsx`
- 로그인 페이지 CSS: `src/app/public/login/login.module.css`
- 인증 교환 코드 (분리 완료): `src/app/api/public/auth/exchange/store.ts`
- 인증 상태 (분리 필요): `src/app/api/public/auth/state/route.ts`
- 프로젝트 규칙: `docs/# AI_CONTEXT.ini`

## 6. 작업 규칙

- 한 단계씩 진행하고 승인 후 다음 단계로
- 변경 전 목적 설명, 변경 후 결과 설명
- AI_CONTEXT.ini 규칙 준수
- 작동하는 로직을 임의로 수정하지 않음
- 구조 분리 시 기능 동일성 유지
