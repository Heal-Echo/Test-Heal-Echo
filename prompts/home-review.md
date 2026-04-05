다음 3개의 참조 문서를 모두 읽은 후, src/app/home/ 폴더의 전체 검수 및 코드 수정을 수행해줘.
단, src/app/home/profile-setup/은 이미 별도 검수 완료했으므로 제외한다.

참조 문서:
1. 페이지별_코드검증_질문리스트.md (프로젝트 루트)
2. docs/Harness Coding/HealEcho_Structural_Convergence_Rules.md
3. docs/Harness Coding/HealEcho_Evaluation_Framework.md

검수 대상 파일 (6개, 총 2655줄):
- src/app/home/page.tsx (562줄)
- src/app/home/ProgramSelectModal.tsx (114줄)
- src/app/home/WellnessCarousel.tsx (163줄)
- src/app/home/home.module.css (1040줄)
- src/app/home/pricing/page.tsx (321줄)
- src/app/home/pricing/pricing.module.css (455줄)

⚠️ 최우선 경고 — 기존 사용자 데이터 보호
이 페이지는 profileSetupDone과 program_confirmed 두 개념이 모두 존재하는 핵심 허브 페이지다.
과거 profile-setup 수정 시 2번이나 기존 사용자가 "프로필 미완료"로 잘못 분류되어 롤백한 이력이 있다.

1. profileSetupDone 플래그를 false로 바꾸거나 리셋하는 코드를 절대 작성하지 마.
2. 기존 AWS DynamoDB에 profileSetupDone: true인 사용자가 존재한다. 새 기기/캐시 초기화 후에도 정상 인식되어야 한다.
3. 코드 수정 시 반드시 두 시나리오를 모두 통과하는지 확인해줘:
   - 시나리오 A: 완전 신규 사용자 (처음 가입)
   - 시나리오 B: 기존 사용자 + 빈 로컬스토리지 (새 기기/캐시 클리어)
4. localStorage에만 의존하는 가드를 만들지 마. AWS 데이터 hydration 이후에 판단해야 한다.

⚠️ 개념 분리 — 절대 섞지 마 (CLAUDE.md 참조)
- "프로필 셋업 완료" = 온보딩 데이터 수집 (wellnessGoal, nickname, dietHabit 등). profileSetupDone 플래그로 판단.
- "솔루션 선택 확정" = 고객이 HOME에서 프로그램을 직접 선택. program_confirmed 플래그로 판단.
- 이 둘은 완전히 독립된 개념이다. wellnessGoal은 분석용 참조 데이터일 뿐, 솔루션 선택과 무관하다.
- 코드 수정 시 이 두 개념이 섞이고 있지 않은지 매 수정마다 확인해줘.

실행 규칙:
- 각 Phase에서 문제가 발견되면 즉시 코드를 수정해줘.
- 수정 전에 "왜 수정하는지" 한 줄 설명을 먼저 해줘.
- 한 번에 너무 많은 파일을 동시에 바꾸지 말고, 파일 하나씩 순서대로 수정해줘.
- CLAUDE.md의 "변경 안전 규칙"을 반드시 준수해줘. 요청하지 않은 가드, 리다이렉트, UI 변경은 하지 마.
- 수정할 때마다 "이 변경이 기존 사용자(시나리오 B)에게 영향을 주는가?" 자문하고 답을 적어줘.

Phase 1 — Structural Convergence Rules 검증 + 수정
HealEcho_Structural_Convergence_Rules.md의 Harness Rules(N, S, D, A, DF, M, I 카테고리)를 home 파일들에 적용해줘.
- 각 룰별 PASS/FAIL 판정
- FAIL 항목은 위반 위치(파일명:라인)를 표시하고, 바로 코드를 수정해줘
- 단, profileSetupDone/program_confirmed 판단 로직과 관련된 코드는 구조만 개선하고 동작을 변경하지 마
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
- HOME은 프로필 hydration + 솔루션 선택이 만나는 곳이므로, 두 개념이 섞이지 않는지 특히 집중 검토해줘
- 해당 없는 카테고리는 "해당 없음" 처리하고 넘어가줘

Phase 3 — Evaluation Framework 평가
HealEcho_Evaluation_Framework.md 기준으로 Phase 1, 2 수정이 반영된 최종 코드를 E1~E7 항목으로 평가해줘.
- 각 항목별 점수와 등급(A~D) 산출
- 종합 등급 산출
- 추가 개선이 필요한 항목이 있으면 코드를 수정하고 재평가해줘

Phase 4 — 기존 사용자 영향 + 개념 분리 최종 검증
모든 수정이 끝난 후, 아래를 확인해줘:
- 수정된 코드에서 profileSetupDone을 false로 설정하거나 리셋하는 곳이 없는지 확인
- 시나리오 B (기존 사용자 + 빈 로컬스토리지)가 정상 동작하는지 page.tsx의 hydration 흐름을 추적해서 확인
- wellnessGoal이 솔루션 선택(program_confirmed)에 영향을 주는 코드가 없는지 확인
- ProgramSelectModal에서 profileSetupDone과 무관하게 동작하는지 확인
- 결과를 "기존 사용자 영향 + 개념 분리 검증 결과" 섹션으로 보여줘

최종 출력:
모든 Phase 완료 후 아래 형식으로 최종 리포트를 작성해줘:
- 수정한 파일 목록과 변경 요약
- 각 수정이 기존 사용자(시나리오 B)에게 미치는 영향 여부
- Structural Rules 최종 PASS/FAIL 결과표
- Evaluation Framework 최종 점수표 (E1~E7 + 종합 등급)
- 기존 사용자 영향 + 개념 분리 검증 결과
- 잔여 이슈 (있다면)
