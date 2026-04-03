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
