# CLAUDE.md — Project Instructions for Claude Code

## About the User
- Non-developer with zero programming experience. Building everything with AI assistance only.
- Always explain technical terms with simple analogies or plain-language descriptions.
- Explain in Korean (한국어). Code and code comments in English.

## Project: Heal Echo (힐에코)
A wellness solution providing:
- Yoga video content
- Sleep habit and dietary habit videos and tracking
- 'Sea of Understanding' meditation sessions
- Mind habit content
- Self-check based periodic assessments and personalized wellness reports

## Tech Stack
- Frontend: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- Backend: AWS Lambda (TypeScript/Node.js) + API Gateway V2 (HTTP API)
- Database: AWS DynamoDB (NoSQL)
- Auth: AWS Cognito (Google, Kakao, Naver, Apple SSO)
- Infrastructure: AWS CDK v2 (TypeScript) — S3, CloudFront, Lambda, EventBridge, AWS Backup, IAM
- Payments: Toss Payments SDK
- Key Libraries: Axios, Zod, js-cookie

## Core Principles
- Work at world-class full-stack developer and AWS architect level.
- Explain changes in simple, step-by-step language before showing code.
- Break work into small steps. Never make too many changes at once.
- This web app will integrate with a mobile app in the future. Design all APIs as platform-agnostic, not web-only.
- Keep authentication JWT-based. Never mix session-based logic.
- Always use S3 for file uploads. Never store files on the server locally.
- Separate components for reusability. Clearly separate business logic from UI logic.
- Avoid hardcoding. Use environment variables and config files.

## Concept Separation (개념 분리 — 절대 섞지 말 것)
- **프로필 셋업 완료** = 온보딩 데이터 수집 (wellnessGoal, nickname, dietHabit 등). `profileSetupDone` 플래그로 판단.
- **솔루션 선택 확정** = 고객이 HOME에서 프로그램을 직접 선택. `program_confirmed` 플래그로 판단.
- 이 둘은 **완전히 독립된 개념**이다. 프로필 셋업의 wellnessGoal은 분석용 참조 데이터일 뿐, 솔루션 선택과 무관하다.
- 코드를 변경할 때 이 두 개념이 섞이고 있지 않은지 반드시 확인한다.

## Existing User Impact Check (기존 사용자 영향 체크)
- When modifying authentication, profile, subscription, or guard logic: ALWAYS check the impact on existing users who already have data in AWS.
- Never assume all users will go through the new flow. Existing users may have completed their profile months ago and have no local storage data on a new device.
- Before adding any new guard or redirect: verify that existing AWS data (profile, preferences, subscriptions) is properly hydrated to local storage FIRST, so existing users are not blocked.
- Test both scenarios: (1) brand new user going through the flow for the first time, (2) existing user with data in AWS but empty local storage (new device / cleared cache).
- The profile-setup wellnessGoal is reference data for analytics only. It does NOT determine the user's solution selection. The customer journey for solution selection starts from the HOME page.

## Change Safety Rules (변경 안전 규칙)
- **요청한 것만 변경**: 요청하지 않은 UI, 가드, 리다이렉트를 추가/삭제하지 않는다.
- **DB 데이터 확인 우선**: 코드만 읽고 추측하지 말고, 실제 DynamoDB에 어떤 필드가 존재하는지 확인한다.
- **되돌릴 수 없는 변경 금지**: `profileSetupDone=false`처럼 기존 데이터를 파괴적으로 변경하는 코드를 작성하지 않는다. 복원이 불가능한 변경은 반드시 사전 확인을 받는다.
- **No unauthorized text modifications**: Do not modify existing text, labels, descriptions, or UI copy without explicit request. Even if a typo or wording improvement seems needed, always get confirmation before changing any text content.
- **가드 추가 전 체크리스트**: 새로운 가드/리다이렉트를 추가할 때 반드시 다음을 확인한다:
  1. 이 조건을 충족하지 못하는 기존 사용자가 있는가?
  2. AWS에 데이터가 있지만 로컬 스토리지에 없는 사용자는 어떻게 되는가?
  3. 기존 사용자가 이 가드에 의해 차단되면 어떤 일이 발생하는가?

## Page Verification
When asked for "page verification" or "code verification," reference '페이지별_코드검증_질문리스트.md' in the project root and work through categories one at a time:
1. Structure & Code Quality
2. Security
3. API Design
4. Database
5. Error Handling & Logging
6. Performance
7. Responsive Design & Accessibility
8. Mobile App Readiness
9. AWS Infrastructure
After each category, ask "다음 단계로 넘어갈까요?" before proceeding.
