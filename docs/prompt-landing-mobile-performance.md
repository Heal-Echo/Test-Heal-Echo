# Landing 페이지 모바일 성능 추가 개선 프롬프트

## 배경
`public/landing` 페이지의 모바일/태블릿 최적화 1차 작업이 완료되었습니다(2026-03-25).
완료 항목은 `AI_CONTEXT.ini` → "모바일 웹 최적화 진행 현황 (2026-03-25)" 섹션에 기록되어 있습니다.

아이폰 X 등 구형 모바일 기기에서 노트북/태블릿 대비 체감 로딩이 느린 문제가 남아 있습니다.

## 이번 세션에서 해야 할 작업

### 1. CSS 렌더링 부하 경감 (모바일 성능 직접 영향)

**backdrop-filter 제거/대체:**
- `landing.module.css`의 `.programBadge`에 `backdrop-filter: blur(8px)` 사용 중
- 모바일 GPU에 부담이 큰 속성 → 모바일(480px 이하)에서 반투명 배경색(`background: rgba(0,0,0,0.5)`)으로 대체
- `PublicHeader.module.css`에도 backdrop-filter가 있는지 확인 후 동일 처리

**box-shadow 경량화:**
- 카드류(`.programCard`, `.benefitCard`, `.bellaCard`, `.empathyFrame`)에 겹친 box-shadow
- 모바일(480px 이하)에서 box-shadow를 단일 레이어로 단순화

### 2. JavaScript 실행 부하 경감

**서버 컴포넌트 분리 검토:**
- 현재 전체 페이지가 `"use client"` → 모든 JS가 클라이언트에서 실행
- Hero, Programs, Benefits, Evidence, Why, Footer 등 정적 섹션은 클라이언트 상태가 필요 없음
- 클라이언트 상태가 필요한 부분(Introduction Video, Coming Soon 모달, 프로그램 하이라이트)만 별도 클라이언트 컴포넌트로 분리
- 나머지는 서버 컴포넌트로 전환하면 클라이언트에 전달되는 JS 양이 대폭 감소

### 3. API 호출 최적화

**Introduction 비디오 API:**
- 현재 `useEffect`에서 `listPublicVideos()` 호출 → 클라이언트 사이드 fetch
- 서버 컴포넌트로 전환 시 서버에서 직접 API 호출 가능 → 클라이언트 네트워크 왕복 제거
- 또는 ISR(Incremental Static Regeneration) 적용하여 캐싱 가능

## 작업 원칙
1. `AI_CONTEXT.ini` 문서를 참조합니다
2. 작업은 한 번에 한 단계씩 진행합니다
3. 하나의 작업을 하면 어떤 목적으로 무슨 작업을 했는지 설명합니다
4. 다음 단계 작업 전에 승인을 받고 진행합니다
5. 코드 수정 전에 반드시 현재 파일 상태를 확인합니다

## 관련 파일
- `src/app/public/landing/page.tsx` — 메인 페이지 컴포넌트
- `src/app/public/landing/landing.module.css` — 스타일
- `src/components/publicSite/PublicHeader.tsx` — 헤더
- `src/components/publicSite/PublicHeader.module.css` — 헤더 스타일
- `src/api/client.ts` — API 클라이언트 (listPublicVideos)
- `src/config/constants.ts` — CloudFront URL 생성 함수

## 우선순위
1번(CSS 경량화) → 2번(서버 컴포넌트 분리) → 3번(API 최적화) 순서로 진행을 권장합니다.
1번은 CSS만 수정하므로 위험이 가장 낮고, 2번은 파일 구조 변경이 필요하므로 신중하게 진행해야 합니다.
