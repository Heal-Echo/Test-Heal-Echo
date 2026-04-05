다음 3개의 참조 문서를 모두 읽은 후, src/app/public/login/ 폴더의 전체 검수 및 코드 수정을 수행해줘.

참조 문서:
1. 페이지별_코드검증_질문리스트.md (프로젝트 루트)
2. docs/Harness Coding/HealEcho_Structural_Convergence_Rules.md
3. docs/Harness Coding/HealEcho_Evaluation_Framework.md

검수 대상 파일 (16개, 총 2908줄):
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
- 각 Phase에서 문제가 발견되면 즉시 코드를 수정해줘.
- 수정 전에 "왜 수정하는지" 한 줄 설명을 먼저 해줘.
- 한 번에 너무 많은 파일을 동시에 바꾸지 말고, 파일 하나씩 순서대로 수정해줘.
- CLAUDE.md의 "변경 안전 규칙"을 반드시 준수해줘. 요청하지 않은 가드, 리다이렉트, UI 변경은 하지 마.
- 로그인은 인증(Auth) 핵심 페이지이므로 보안(E1) 항목을 특히 엄격하게 검증해줘.

Phase 1 — Structural Convergence Rules 검증 + 수정
HealEcho_Structural_Convergence_Rules.md의 Harness Rules(N, S, D, A, DF, M, I 카테고리)를 login 파일들에 적용해줘.
- 각 룰별 PASS/FAIL 판정
- FAIL 항목은 위반 위치(파일명:라인)를 표시하고, 바로 코드를 수정해줘
- 수정 완료 후 PASS/FAIL 결과표를 다시 보여줘

Phase 2 — 페이지별 코드검증 질문리스트 수행 + 수정
페이지별_코드검증_질문리스트.md의 10개 카테고리를 순서대로 적용해줘:
1. 구조 & 코드 품질
2. 보안
3. API 설계
4. 데이터베이스
5. 에러 핸들링 & 로깅
6. 성능
7. 반응형 디자인 & 접근성
8. 모바일 앱 준비
9. AWS 인프라
10. 종합
- 각 카테고리에서 개선이 필요한 코드가 있으면 바로 수정해줘
- 로그인 페이지 특성상 해당 없는 카테고리는 "해당 없음" 처리하고 넘어가줘

Phase 3 — Evaluation Framework 평가
HealEcho_Evaluation_Framework.md 기준으로 Phase 1, 2 수정이 반영된 최종 코드를 E1~E7 항목으로 평가해줘.
- 각 항목별 점수와 등급(A~D) 산출
- 종합 등급 산출
- 추가 개선이 필요한 항목이 있으면 코드를 수정하고 재평가해줘

최종 출력:
모든 Phase 완료 후 아래 형식으로 최종 리포트를 작성해줘:
- 수정한 파일 목록과 변경 요약
- Structural Rules 최종 PASS/FAIL 결과표
- Evaluation Framework 최종 점수표 (E1~E7 + 종합 등급)
- 잔여 이슈 (있다면)
