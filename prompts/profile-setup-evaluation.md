다음 참조 문서들을 모두 읽은 후, src/app/home/profile-setup/ 폴더와 관련 API의 Evaluation Framework 평가를 수행해줘.

참조 문서:
1. docs/Harness Coding/HealEcho_Evaluation_Framework.md
2. CLAUDE.md (프로젝트 루트)

평가 대상 파일:
- src/app/home/profile-setup/page.tsx (672줄)
- src/app/home/profile-setup/profileSetup.module.css (1121줄)
- src/app/api/user/profile/route.ts (105줄)

⚠️ 최우선 경고 — 기존 사용자 데이터 보호
이 페이지는 과거 수정 시 2번이나 기존 사용자가 "프로필 미완료"로 잘못 분류되어 롤백한 이력이 있다.
아래 규칙을 절대적으로 지켜줘:

1. profileSetupDone 플래그를 false로 바꾸거나 리셋하는 코드를 절대 작성하지 마.
2. 기존 AWS DynamoDB에 profileSetupDone: true인 사용자가 존재한다. 새 기기/캐시 초기화 후에도 정상 인식되어야 한다.
3. 코드 수정 시 반드시 두 시나리오를 모두 통과하는지 확인해줘:
   - 시나리오 A: 완전 신규 사용자 (처음 가입)
   - 시나리오 B: 기존 사용자 + 빈 로컬스토리지 (새 기기/캐시 클리어)
4. localStorage에만 의존하는 가드를 만들지 마. AWS 데이터 hydration 이후에 판단해야 한다.

⚠️ 개념 분리 — 절대 섞지 마
- "프로필 셋업 완료" = 온보딩 데이터 수집. profileSetupDone 플래그로 판단.
- "솔루션 선택 확정" = HOME에서 프로그램 직접 선택. program_confirmed 플래그로 판단.
- 이 둘은 완전히 독립된 개념이다. wellnessGoal은 분석용 참조 데이터일 뿐, 솔루션 선택과 무관하다.

실행 규칙:
- CLAUDE.md의 모든 원칙(개념 분리, 변경 안전 규칙, 기존 사용자 영향 체크)을 준수해줘.
- 코드를 수정해야 할 경우, 수정 전에 "왜 수정하는지" 한 줄 설명을 먼저 해줘.
- 한 번에 너무 많은 파일을 동시에 바꾸지 말고, 파일 하나씩 순서대로 수정해줘.
- 수정할 때마다 "이 변경이 기존 사용자(시나리오 B)에게 영향을 주는가?" 자문하고 답을 적어줘.

평가 수행:
HealEcho_Evaluation_Framework.md 기준으로 E1~E7 항목을 순서대로 평가해줘:
- E1 Security (25%) — 인증 무결성, API 보호, profileSetupDone 판단 흐름의 안전성
- E2 Functionality (20%) — 온보딩 플로우, 프로필 데이터 저장/조회, 기존 사용자 데이터 hydration
- E3 Error Handling (15%) — API 에러 처리, 사용자 피드백, 네트워크 오류 대응
- E4 Performance (15%) — 초기 로드, 불필요한 리렌더링, 번들 크기
- E5 Responsive & Accessibility (10%) — 모바일 반응형, WCAG 접근성
- E6 Database (10%) — DynamoDB 스키마, profileSetupDone 데이터 일관성, API route의 데이터 처리
- E7 Logging & Monitoring (5%) — 서버/클라이언트 로깅

각 항목별로:
1. 세부 체크리스트 항목별 PASS/FAIL 판정
2. FAIL 항목은 위반 위치(파일명:라인)를 표시하고, 코드를 수정해줘
3. 수정 후 해당 항목 재평가
4. 최종 점수 산출

최종 출력:
평가 완료 후 아래 형식으로 최종 리포트를 작성해줘:
- 수정한 파일 목록과 변경 요약 (수정이 있었을 경우)
- 각 수정이 기존 사용자(시나리오 B)에게 미치는 영향 여부
- Evaluation Framework 최종 점수표 (E1~E7 각 점수 + 가중 점수 + 종합 등급 A~D)
- 잔여 이슈 (있다면)
