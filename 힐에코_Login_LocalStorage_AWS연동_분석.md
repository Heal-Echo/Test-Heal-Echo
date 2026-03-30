# Heal Echo Login 페이지 — LocalStorage 의존성 분석 및 AWS 연동 리스크 평가

**2026년 3월 23일 | 모바일 웹/앱 전환 대비 기술 분석**

---

## 1. 분석 개요

`/public/login` 페이지를 중심으로, 로그인/회원가입/소셜 인증 전체 흐름에서 localStorage·sessionStorage·쿠키에 의존하는 패턴을 분석하였습니다. 향후 모바일 웹(인앱 브라우저)이나 네이티브 앱(React Native/Flutter)으로 전환할 때, 클라이언트 저장소에만 저장되어 AWS 연동이 끊기거나 인증 흐름이 깨지는 문제가 발생할 가능성을 평가합니다.

**결론:** Login 페이지의 인증 데이터는 본질적으로 AWS Cognito와 연동되어 있어, "localStorage에만 저장되어 AWS와 동기가 안 되는" 문제는 발생하지 않습니다. 다만, 소셜 로그인의 OAuth 콜백 흐름(쿠키 기반 토큰 전달)과 CSRF state 검증(sessionStorage 기반)이 모바일 환경에서 깨질 수 있는 구조적 리스크가 존재합니다.

---

## 2. Login 페이지의 전체 인증 아키텍처

### 2.1 지원하는 로그인 방식 (5가지)

| 방식 | 흐름 | Cognito 연동 |
|------|------|-------------|
| 이메일/비밀번호 | Cognito SDK 직접 인증 → JWT 발급 | 직접 연동 |
| 카카오 로그인 | 카카오 OAuth → 서버 콜백 → Cognito AdminInitiateAuth → 쿠키로 JWT 전달 | 하이브리드 |
| 네이버 로그인 | 네이버 OAuth → 서버 콜백 → Cognito AdminInitiateAuth → 쿠키로 JWT 전달 | 하이브리드 |
| 구글 로그인 | 구글 OAuth → 서버 콜백 → Cognito AdminInitiateAuth → 쿠키로 JWT 전달 | 하이브리드 |
| 애플 로그인 | 애플 OAuth → 서버 콜백 → Cognito AdminInitiateAuth → 쿠키로 JWT 전달 | 하이브리드 |

핵심 설계: 모든 로그인 방식이 최종적으로 Cognito JWT 토큰을 발급받아 `storage.setRaw()`로 저장합니다. **인증 데이터 자체는 Cognito(AWS)가 권위 있는 출처(source of truth)**이며, localStorage는 클라이언트 세션 유지를 위한 캐시 역할입니다.

### 2.2 저장되는 키 전체 목록

| 키 | 저장소 | 저장 시점 | 용도 |
|----|--------|----------|------|
| `user_id_token` | localStorage | 로그인 성공 시 | Cognito JWT ID 토큰 (API 인증) |
| `user_access_token` | localStorage | 로그인 성공 시 | Cognito JWT Access 토큰 |
| `user_email` | localStorage | 로그인/회원가입 시 | 사용자 이메일 |
| `user_login_method` | localStorage | 소셜 로그인 시 | "kakao" / "naver" / "google" / "apple" |
| `user_kakao_id` | localStorage | 카카오 로그인 시 | Cognito sub (사용자 식별자) |
| `user_kakao_nickname` | localStorage | 카카오 로그인 시 | JWT에서 추출한 닉네임 |
| `user_kakao_profile_image` | localStorage | 카카오 로그인 시 | 프로필 이미지 URL |
| `user_naver_id` / `user_google_id` / `user_apple_id` | localStorage | 각 소셜 로그인 시 | Cognito sub |
| `user_naver_nickname` / `user_google_nickname` / `user_apple_nickname` | localStorage | 각 소셜 로그인 시 | JWT에서 추출한 닉네임 |
| `google_oauth_state` | sessionStorage | 구글 로그인 시작 시 | CSRF state 파라미터 검증 |
| `naver_oauth_state` | sessionStorage | 네이버 로그인 시작 시 | CSRF state 파라미터 검증 |
| `apple_oauth_state` | sessionStorage | 애플 로그인 시작 시 | CSRF state 파라미터 검증 |
| `redirect_after_login` | sessionStorage | 보호 페이지 접근 시 | 로그인 후 돌아갈 경로 |
| `logoutFrom` | sessionStorage | 로그아웃 시 | 뒤로가기 방지 플래그 |
| `cognito_id_token` (쿠키) | document.cookie | OAuth 콜백 시 | 서버→클라이언트 토큰 전달 (60초 TTL) |
| `cognito_access_token` (쿠키) | document.cookie | OAuth 콜백 시 | 서버→클라이언트 토큰 전달 (60초 TTL) |
| `CognitoIdentityServiceProvider.*` | localStorage | Cognito SDK 내부 | SDK 세션 관리 (추상화 어댑터 경유) |

---

## 3. 데이터별 상세 분석

### 3.1 인증 토큰 (user_id_token, user_access_token)

**위험도: 🟢 낮음 — AWS 연동 완료**

localStorage에 저장되지만, 이것은 Cognito가 발급한 JWT의 클라이언트 캐시입니다. 토큰이 유실되면 재로그인으로 다시 발급받을 수 있고, `tokenManager.ts`가 만료 시 Cognito SDK의 refresh token으로 자동 갱신합니다.

- 이메일 로그인: `userLogin()` → Cognito SDK `authenticateUser()` → JWT 발급 → `storage.setRaw()` 저장
- 소셜 로그인: 서버 콜백 → `AdminInitiateAuth` → 쿠키로 전달 → 클라이언트에서 `storage.setRaw()` 저장
- 토큰 갱신: `tokenManager.ensureValidToken()` → Cognito SDK `getSession()` → refresh token 자동 갱신
- **localStorage가 지워져도 재로그인으로 완전 복구 가능**

### 3.2 소셜 프로필 정보 (user_kakao_nickname 등)

**위험도: 🟡 중간 — localStorage에만 존재하지만 JWT에서 복원 가능**

`saveCognitoKakaoSession()` 등에서 Cognito JWT의 payload를 파싱하여 nickname, sub, email을 localStorage에 저장합니다. 이 정보는 JWT를 다시 발급받으면 복원할 수 있습니다.

- `user_kakao_nickname`: JWT의 `nickname` 또는 `cognito:username` 클레임에서 추출
- `user_kakao_id`: JWT의 `sub` 클레임에서 추출
- `user_login_method`: "kakao" / "naver" / "google" / "apple" 문자열

**리스크:** localStorage가 지워지면 `getUserName()`이 닉네임을 찾지 못해 일시적으로 이름이 표시되지 않을 수 있습니다. 하지만 재로그인 시 JWT에서 다시 추출되므로 영구적 데이터 유실은 아닙니다.

**보완 필요:** `user_login_method`은 현재 JWT 클레임에 포함되지 않아, 토큰 갱신만으로는 복원 불가. Cognito `custom:signup_method` 속성에는 저장되어 있으므로, 사용자 속성 조회 API를 통해 복원하는 로직 추가를 권장합니다.

### 3.3 OAuth CSRF State (sessionStorage)

**위험도: 🔴 높음 — 모바일 환경에서 깨질 수 있음**

구글/네이버/애플 로그인 시 CSRF 방지를 위해 `sessionStorage`에 state 파라미터를 저장합니다.

```
getGoogleLoginUrl() → storage.setSession("google_oauth_state", state)
→ 구글 인증 페이지로 이동
→ 콜백 시 state 검증
```

**모바일 리스크:**
- **인앱 브라우저 전환:** 카카오톡, 라인 등의 인앱 브라우저에서 소셜 로그인 버튼을 누르면, 외부 브라우저(Safari/Chrome)로 전환될 수 있습니다. sessionStorage는 탭/창 간에 공유되지 않으므로, 콜백 시 state를 검증할 수 없습니다.
- **네이티브 앱:** sessionStorage 자체가 존재하지 않으므로, 인메모리 Map 또는 앱 내부 상태로 교체해야 합니다.
- **현재 완화:** 카카오 로그인은 sessionStorage state를 사용하지 않고 서버에서 직접 처리하므로 이 문제가 없습니다. 구글/네이버/애플은 state 검증 로직이 서버 콜백에서 처리되므로, 클라이언트 sessionStorage state는 실제로 검증에 사용되지 않을 수 있습니다.

**확인 필요:** 서버 콜백 라우트(`/api/public/auth/google/callback` 등)에서 실제로 sessionStorage의 state를 검증하는지, 아니면 서버 측에서 별도 검증하는지 확인이 필요합니다. 현재 카카오 콜백 라우트를 보면 서버에서 state 검증 없이 code만 교환하는 구조이므로, sessionStorage state는 미래의 검증 로직을 위한 준비로 보입니다.

### 3.4 쿠키 기반 토큰 전달 (cognito_id_token, cognito_access_token)

**위험도: 🔴 높음 — 모바일 환경에서 깨질 수 있음**

소셜 로그인의 핵심 흐름입니다:

```
서버 콜백 → 쿠키에 JWT 설정 (60초 TTL, httpOnly: false)
→ /public/login?kakao_cognito_callback=1 로 리다이렉트
→ 클라이언트에서 getCookie()로 읽기 → localStorage에 저장 → 쿠키 삭제
```

**모바일 리스크:**
- **iOS Safari의 ITP (Intelligent Tracking Prevention):** 3rd-party 쿠키를 차단하고, 1st-party 쿠키도 제한적으로 관리합니다. sameSite: "lax"로 설정되어 있어 리다이렉트 시에는 동작하지만, 인앱 브라우저에서는 예측 불가한 동작이 발생할 수 있습니다.
- **인앱 브라우저 쿠키 격리:** 카카오톡/네이버 앱의 인앱 브라우저는 별도의 쿠키 저장소를 사용합니다. 서버에서 설정한 쿠키가 리다이렉트 후 클라이언트에서 읽히지 않을 수 있습니다.
- **네이티브 앱:** `document.cookie` API가 존재하지 않습니다. deep link 또는 RN bridge를 통해 토큰을 전달해야 합니다.

**현재 코드의 설계 의도:** `storage.ts`의 주석에 이미 "향후 앱 전환 시 deep link 파라미터, URL scheme, 또는 React Native 브릿지로 교체 가능"이라고 명시되어 있습니다. 추상화 레이어가 준비되어 있지만, 실제 교체 구현은 아직 없습니다.

### 3.5 리다이렉트 경로 (redirect_after_login)

**위험도: 🟡 중간**

보호 페이지에 비로그인 상태로 접근 → `sessionStorage`에 원래 경로 저장 → 로그인 후 복원하는 패턴입니다.

- `getPostLoginRedirect()`: sessionStorage에서 `redirect_after_login`을 읽고, 없으면 `/home`으로 폴백
- **모바일 리스크:** sessionStorage가 없으면 항상 `/home`으로 이동 (기능 저하일 뿐, 치명적이지 않음)
- **네이티브 앱:** 인메모리 Map으로 교체 가능 (storage.ts 주석에 명시)

### 3.6 로그아웃 출처 (logoutFrom)

**위험도: 🟢 낮음**

마이페이지에서 로그아웃 후 뒤로가기 방지용 sessionStorage 플래그입니다.

- 없으면 뒤로가기가 정상 동작할 뿐, 보안이나 데이터에 영향 없음
- **모바일 앱:** Navigation stack 관리로 대체 가능

### 3.7 Cognito SDK 내부 저장소

**위험도: 🟢 낮음 — 추상화 완료**

`CognitoIdentityServiceProvider.*` 형태의 키들이 Cognito JS SDK 내부에서 사용됩니다. 이미 `cognitoStorageAdapter`를 통해 `storage.ts` 추상화 레이어를 경유하도록 설정되어 있습니다.

```typescript
export const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: APP_CLIENT_ID,
  Storage: cognitoStorageAdapter,  // ← 추상화 레이어 경유
});
```

**앱 전환 시:** `cognitoStorageAdapter`를 AsyncStorage 기반으로 교체하면 SDK가 자동 대응합니다.

---

## 4. 위험도 종합 매트릭스

| 영역 | 저장소 | 위험도 | AWS 연동 | 모바일 전환 시 영향 |
|------|--------|--------|----------|-------------------|
| JWT 토큰 | localStorage | 🟢 낮음 | ✅ Cognito 발급 | storage.ts 교체로 대응 |
| Cognito SDK 세션 | localStorage | 🟢 낮음 | ✅ 어댑터 추상화 | storage.ts 교체로 대응 |
| 소셜 닉네임/ID | localStorage | 🟡 중간 | ⚠️ JWT에서 추출 | 재로그인으로 복구, login_method만 보완 필요 |
| **OAuth state (CSRF)** | **sessionStorage** | **🔴 높음** | **N/A** | **인앱 브라우저 전환 시 state 유실 가능** |
| **쿠키 토큰 전달** | **cookie** | **🔴 높음** | **서버→클라이언트** | **인앱 브라우저 쿠키 격리, 네이티브 앱 미지원** |
| 리다이렉트 경로 | sessionStorage | 🟡 중간 | N/A | 폴백 /home 작동, 기능 저하만 |
| 로그아웃 플래그 | sessionStorage | 🟢 낮음 | N/A | 뒤로가기 방지 미작동 (비치명적) |

---

## 5. 모바일 환경별 상세 리스크

### 5.1 모바일 웹 (Safari/Chrome 브라우저)

**전반적으로 안전합니다.** 모바일 브라우저는 localStorage, sessionStorage, cookie를 모두 지원합니다.

주의 사항:
- iOS Safari ITP: 7일 미방문 시 localStorage 삭제 가능 → 재로그인 필요 (토큰은 Cognito에서 재발급)
- 브라우저 데이터 삭제: 모든 인증 정보 유실 → 재로그인 필요 (데이터 영구 유실 없음)
- 시크릿/프라이빗 모드: localStorage가 세션 종료 시 삭제 → 매번 재로그인 필요

### 5.2 인앱 브라우저 (카카오톡, 네이버 등)

**소셜 로그인에서 문제가 발생할 수 있습니다.**

시나리오 예시:
1. 사용자가 카카오톡 인앱 브라우저에서 Heal Echo 접속
2. 구글 로그인 버튼 클릭 → 구글 인증 페이지로 이동
3. 인앱 브라우저에서 외부 브라우저로 전환될 수 있음
4. 콜백 URL이 외부 브라우저에서 열림
5. 서버가 쿠키로 설정한 토큰이 원래 인앱 브라우저에서 접근 불가
6. 인앱 브라우저로 돌아와도 로그인 실패

**카카오 로그인은 상대적으로 안전:** 카카오톡 인앱 브라우저에서 카카오 로그인은 같은 앱 내에서 처리되므로 브라우저 전환이 발생하지 않습니다.

### 5.3 네이티브 앱 (React Native/Flutter)

**전면적인 교체가 필요합니다.**

| 현재 메커니즘 | 교체 필요 | 대안 |
|-------------|----------|------|
| localStorage → JWT 저장 | ✅ | AsyncStorage / SecureStore |
| sessionStorage → OAuth state | ✅ | 인메모리 Map / 앱 내부 상태 |
| document.cookie → 토큰 전달 | ✅ | Deep link params / RN bridge |
| window.location.href → OAuth 시작 | ✅ | Linking.openURL / AuthSession |
| getCookie() → 쿠키 읽기 | ✅ | Deep link 파라미터 파싱 |
| URL searchParams → 콜백 처리 | ✅ | Deep link URL 파싱 |

**긍정적 요소:** `storage.ts` 추상화 레이어가 이미 준비되어 있어, 저장소 교체는 비교적 수월합니다. 다만, OAuth 콜백 흐름 자체(쿠키 기반 토큰 전달)는 아키텍처 레벨의 변경이 필요합니다.

---

## 6. Login 페이지에서 "localStorage에만 저장되어 AWS 연동이 안 되는" 문제는?

### 6.1 결론: 근본적으로 발생하지 않음

Login 페이지의 데이터 특성상, "localStorage에만 저장되어 AWS와 동기가 안 되는" 문제는 구조적으로 발생하지 않습니다. 이유는 다음과 같습니다.

첫째, 인증 데이터의 권위 있는 출처(source of truth)가 AWS Cognito입니다. localStorage에 저장되는 JWT 토큰, 이메일, 닉네임 등은 모두 Cognito에서 발급하거나 Cognito 속성에서 추출한 것입니다. localStorage가 비어도 재로그인하면 Cognito에서 다시 발급받을 수 있습니다.

둘째, 로그인 행위 자체가 AWS 연동입니다. `userLogin()`은 Cognito SDK의 `authenticateUser()`를 호출하고, 소셜 로그인은 서버에서 `AdminInitiateAuth`를 호출합니다. 로그인 성공 = AWS 연동 성공입니다.

셋째, 토큰 갱신도 AWS를 경유합니다. `tokenManager.ensureValidToken()`은 Cognito SDK의 `getSession()`을 호출하여 refresh token으로 새 JWT를 발급받습니다.

### 6.2 실제 위험은 "AWS 연동이 안 되는" 문제가 아님

Login 페이지의 실제 모바일 리스크는 localStorage/AWS 동기 문제가 아니라, **인증 흐름 자체가 깨지는 문제**입니다. 구체적으로 소셜 로그인의 OAuth 콜백이 쿠키를 통해 토큰을 전달하는 방식이 인앱 브라우저나 네이티브 앱에서 작동하지 않을 수 있다는 것입니다.

---

## 7. 권장 조치 사항

### 7.1 우선순위 1: 소셜 로그인 OAuth 콜백 대안 경로 구현

**긴급도: 🔴 높음 | 모바일 전환 전 필수**

- 현재 쿠키 기반 토큰 전달을 URL fragment 또는 서버 세션 기반으로 대체
- 대안 A: `#id_token=xxx&access_token=xxx` fragment 방식 (URL에 토큰 노출, HTTPS 필수)
- 대안 B: 서버 세션에 임시 저장 → 클라이언트가 API로 조회 (더 안전하지만 복잡)
- 대안 C: 네이티브 앱에서는 PKCE + Authorization Code Flow를 Cognito Hosted UI로 직접 처리

### 7.2 우선순위 2: OAuth state 검증 개선

**긴급도: 🟡 중간 | 보안 강화**

- 현재 sessionStorage state는 서버 콜백에서 실제 검증되지 않는 것으로 보임
- 서버 세션 또는 encrypted state parameter 방식으로 CSRF 보호 강화
- 네이티브 앱에서는 PKCE (Proof Key for Code Exchange)로 대체

### 7.3 우선순위 3: user_login_method 복원 로직 추가

**긴급도: 🟡 중간 | UX 개선**

- 현재: localStorage에만 "kakao" / "google" 등 저장, JWT에는 미포함
- Cognito 사용자 속성 `custom:signup_method`에는 이미 저장되어 있음
- 토큰 갱신/재로그인 시 사용자 속성을 조회하여 `user_login_method` 자동 복원

### 7.4 우선순위 4: 네이티브 앱용 인증 모듈 설계

**긴급도: 🟢 낮음 | 앱 개발 시점에 진행**

- `storage.ts` 내부를 AsyncStorage / SecureStore로 교체
- OAuth 흐름을 `expo-auth-session` 또는 `react-native-app-auth`로 교체
- deep link 기반 콜백 URL scheme 등록 (`healecho://auth/callback`)
- Cognito Hosted UI + PKCE 플로우 검토

---

## 8. 결론

Login 페이지는 **"localStorage에만 저장되어 AWS 연동이 안 되는" 문제가 구조적으로 발생하지 않는** 영역입니다. 인증 데이터의 source of truth가 AWS Cognito이고, localStorage는 단순 캐시 역할이기 때문입니다. localStorage가 비어도 재로그인으로 완전 복구됩니다.

실제 모바일 전환 시 리스크는 다른 곳에 있습니다. 소셜 로그인의 **쿠키 기반 토큰 전달 방식**이 인앱 브라우저(쿠키 격리)와 네이티브 앱(cookie API 미지원)에서 작동하지 않을 수 있다는 점입니다. 이것은 localStorage/AWS 동기 문제가 아니라, **OAuth 인증 흐름 아키텍처** 문제입니다.

긍정적인 점은 `storage.ts` 추상화 레이어가 이미 잘 설계되어 있고, 각 모듈 주석에 앱 전환 시 교체 방안이 명시되어 있어, 전환 작업의 난이도가 크게 높지 않다는 것입니다.

---

*Heal Echo Technical Analysis — Prepared by Claude*
