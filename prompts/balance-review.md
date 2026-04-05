다음 3개의 참조 문서를 모두 읽은 후, src/app/wellness/balance/ 폴더의 전체 검수 및 코드 수정을 수행해줘.

참조 문서:
1. 페이지별_코드검증_질문리스트.md (프로젝트 루트)
2. docs/Harness Coding/HealEcho_Structural_Convergence_Rules.md
3. docs/Harness Coding/HealEcho_Evaluation_Framework.md

검수 대상 파일 (6개, 총 1485줄):
- src/app/wellness/balance/page.tsx (138줄)
- src/app/wellness/balance/balanceBrain.ts (371줄)
- src/app/wellness/balance/balance.module.css (369줄)
- src/app/wellness/balance/player/page.tsx (176줄)
- src/app/wellness/balance/player/playerBrain.ts (68줄)
- src/app/wellness/balance/player/player.module.css (363줄)

⚠️ 주의 사항
- balanceBrain.ts는 subscription(구독) 정보를 사용한다. 구독 상태 판단 로직의 동작을 변경하지 마.
- player/page.tsx는 canPlayVideo 권한 체크와 JWT 토큰(user_id_token)을 사용한다. 인증/권한 흐름을 변경하지 마.
- CLAUDE.md의 "변경 안전 규칙"을 반드시 준수해줘. 요청하지 않은 가드, 리다이렉트, UI 변경은 하지 마.

⚠️ 개념 분리 — 절대 섞지 마 (CLAUDE.md 참조)
- "프로필 셋업 완료" = profileSetupDone 플래그로 판단.
- "솔루션 선택 확정" = program_confirmed 플래그로 판단.
- 이 둘은 완전히 독립된 개념이다. balance 페이지에 이 두 개념이 섞여 들어가면 안 된다.

실행 규칙:
- 각 Phase에서 문제가 발견되면 즉시 코드를 수정해줘.
- 수정 전에 "왜 수정하는지" 한 줄 설명을 먼저 해줘.
- 한 번에 너무 많은 파일을 동시에 바꾸지 말고, 파일 하나씩 순서대로 수정해줘.

Phase 1 — Structural Convergence Rules 검증 + 수정
HealEcho_Structural_Convergence_Rules.md의 Harness Rules(N, S, D, A, DF, M, I 카테고리)를 balance 파일들에 적용해줘.
- 각 룰별 PASS/FAIL 판정
- FAIL 항목은 위반 위치(파일명:라인)를 표시하고, 바로 코드를 수정해줘
- 단, subscription 판단 로직과 canPlayVideo 권한 체크 관련 코드는 구조만 개선하고 동작을 변경하지 마
- 수정 완료 후 PASS/FAIL 결과표를 다시 보여줘

Phase 2 — 페이지별 코드검증 질문리스트 수행 + 수정
페이지별_코드검증_질문리스트.md의 10개 카테고리를 순서대로 적용해줘:
1. 구조 & 코드 품질
2. 보안 — 특히 player의 JWT 토큰 처리, 비디오 접근 권한 체크 집중 검토
3. API 설계
4. 데이터베이스
5. 에러 핸들링 & 로깅
6. 성능 — 비디오 로딩/스트리밍 성능 집중 검토
7. 반응형 디자인 & 접근성
8. 모바일 앱 준비
9. AWS 인프라
10. 종합
- 각 카테고리에서 개선이 필요한 코드가 있으면 바로 수정해줘
- 해당 없는 카테고리는 "해당 없음" 처리하고 넘어가줘

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
