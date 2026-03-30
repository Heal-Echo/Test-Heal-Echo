# Storage Migration — Phase 4부터 이어서 진행

## 목적

이 프로젝트는 향후 Android/iOS 앱과 연동 예정입니다. 현재 localStorage에 직접 의존하는 코드를 스토리지 추상화 레이어(`src/lib/storage.ts`)를 통해 접근하도록 전환하고, 데이터 흐름을 "AWS 우선 조회, 로컬은 캐시" 패턴으로 변경하는 작업입니다.

---

## 지금까지 완료된 작업 (Phase 1~3)

### Phase 1: 로그아웃 시 사용자 데이터 초기화
- **파일**: `src/auth/user.ts`
- **내용**: `userLogout()` 함수에 사용자 데이터 localStorage 키 전체 삭제 코드 추가 (자가체크, 프로필, 프로그램 선택, 수면 로그, 구독 캐시, 동적 키 순회 삭제 포함)

### Phase 2: 스토리지 추상화 레이어 생성
- **파일**: `src/lib/storage.ts` (신규)
- **내용**: localStorage를 감싸는 중간 레이어. 모든 사용자 데이터 키에 JWT sub(userId)을 자동 포함하여 계정별 격리. `get/set/remove`(userId 자동), `getRaw/setRaw/removeRaw`(공통 키), `getJSON/setJSON`, `clearUserData()`, `migrateKey()` 함수 제공.

### Phase 3: SelfCheck를 storage 레이어로 전환
- **파일**: `src/components/self-check/SelfCheckSurvey.tsx`
- **내용**:
  - `import * as storage from "@/lib/storage"` 추가
  - localStorage 직접 호출 → storage 레이어 호출로 전체 교체
  - `fetchAndHydrateSelfCheckResult()` 데이터 흐름 변경: 기존 "로컬 먼저 → 있으면 반환" → **"AWS 먼저 조회 → 로컬은 캐시"**
  - `storage.migrateKey()`로 기존 키(`selfcheck_result`) → 사용자별 키(`selfcheck_result__userId`) 자동 이전
  - AWS에 데이터 없는데 로컬에 있으면 로컬 캐시 정리 (잔존 데이터 방지)
- **테스트 완료**: 자가체크 미수행 테스트 계정에서 "미검사" 정상 표시 확인

---

## 이번 작업에서 해야 할 일

### Phase 4: Profile을 storage 레이어로 전환

**수정 파일 2개:**
1. `src/app/home/profile-setup/page.tsx`
2. `src/app/home/page.tsx`

**수정 패턴 (Phase 3과 동일):**
1. `import * as storage from "@/lib/storage"` 추가
2. `localStorage.getItem/setItem/removeItem` → `storage.get/set/remove` 등으로 교체
3. 대상 키: `user_profile`, `profile_setup_done`, `profile_aws_pending`
4. `storage.migrateKey()`로 기존 키 → 사용자별 키 자동 이전 추가
5. 데이터 조회 순서를 "AWS 우선, 로컬은 캐시"로 변경 (이미 `home/page.tsx`에 hydrate 로직 존재)

**주의사항:**
- `user_id_token` 키는 인증 토큰이므로 `storage.getRaw()`로 접근 (userId 접두사 없이)
- `# AI_CONTEXT.ini` 파일의 규칙을 반드시 먼저 읽을 것
- CDK deploy 불필요 (프론트엔드만 수정)

**테스트 방법:**
1. 테스트 계정 로그인 → 프로필 설정 완료 → AWS에 저장 확인
2. 로그아웃 → 다른 계정 로그인 → 프로필 설정 화면이 표시되는지 (격리 확인)
3. 원래 계정 재로그인 → 프로필이 AWS에서 복원되는지 확인

---

## 이후 남은 작업 (Phase 5~8)

| Phase | 내용 | CDK deploy |
|---|---|---|
| 5 | 프로그램 선택/시작일 AWS API 신규 + storage 전환 | ✅ 필요 |
| 6 | 커스텀 습관/수면 로그 storage 전환 | ❌ |
| 7 | 구독 캐시 + UI 플래그 정리 | ❌ |
| 8 | userLogout()을 storage.clearUserData()로 통합 | ❌ |

---

## 참조 문서
- 설계 문서: `docs/storage-migration-plan.md`
- 데이터 맵: `docs/localStorage-vs-AWS-data-map.md`
- 프로젝트 컨텍스트: `# AI_CONTEXT.ini`
