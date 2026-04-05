다음 참조 문서들을 모두 읽은 후, src/app/public/login/ 폴더의 Evaluation Framework 평가를 수행해줘.

참조 문서:
1. docs/Harness Coding/HealEcho_Evaluation_Framework.md
2. CLAUDE.md (프로젝트 루트)

평가 대상 파일:
- src/app/public/login/page.tsx
- src/app/public/login/use-login-page.ts
- src/app/public/login/use-email-login.ts
- src/app/public/login/use-signup.ts
- src/app/public/login/use-social-login.ts
- src/app/public/login/use-forgot-password.ts
- src/app/public/login/utils.ts
- src/app/public/login/login.module.css
- src/app/public/login/login-page.module.css
- src/app/public/login/components/login-view.tsx
- src/app/public/login/components/signup-view.tsx
- src/app/public/login/components/confirm-view.tsx
- src/app/public/login/components/forgot-step1-view.tsx
- src/app/public/login/components/forgot-step2-view.tsx
- src/app/public/login/components/terms-consent-checkbox.tsx

실행 규칙:
- CLAUDE.md의 모든 원칙(개념 분리, 변경 안전 규칙, 기존 사용자 영향 체크)을 준수해줘.
- 로그인은 인증(Auth) 핵심 페이지이므로 E1 Security를 특히 엄격하게 평가해줘.
- 코드를 수정해야 할 경우, 수정 전에 "왜 수정하는지" 한 줄 설명을 먼저 해줘.
- 한 번에 너무 많은 파일을 동시에 바꾸지 말고, 파일 하나씩 순서대로 수정해줘.
- profileSetupDone 판단 로직에 영향을 주는 수정은 하지 마.

평가 수행:
HealEcho_Evaluation_Framework.md 기준으로 E1~E7 항목을 순서대로 평가해줘:
- E1 Security (25%) — OAuth 상태 파라미터, CSRF 방어, JWT 토큰 관리, 입력값 검증, XSS 방어
- E2 Functionality (20%) — 로그인/회원가입/비밀번호 찾기 플로우, SSO(Google/Kakao/Naver/Apple) 동작
- E3 Error Handling (15%) — API 에러 처리, 사용자 피드백, 네트워크 오류 대응
- E4 Performance (15%) — 초기 로드, 불필요한 리렌더링, 번들 크기
- E5 Responsive & Accessibility (10%) — 모바일 반응형, WCAG 접근성
- E6 Database (10%) — 해당 시 DynamoDB 스키마/데이터 일관성
- E7 Logging & Monitoring (5%) — 서버/클라이언트 로깅

각 항목별로:
1. 세부 체크리스트 항목별 PASS/FAIL 판정
2. FAIL 항목은 위반 위치(파일명:라인)를 표시하고, 코드를 수정해줘
3. 수정 후 해당 항목 재평가
4. 최종 점수 산출

최종 출력:
평가 완료 후 아래 형식으로 최종 리포트를 작성해줘:
- 수정한 파일 목록과 변경 요약 (수정이 있었을 경우)
- Evaluation Framework 최종 점수표 (E1~E7 각 점수 + 가중 점수 + 종합 등급 A~D)
- 잔여 이슈 (있다면)
