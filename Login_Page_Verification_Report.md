# Login Page Code Verification Report

> **Project:** Heal Echo | **Page:** src/app/public/login/ | **Date:** 2026-04-03

---

## Summary Table

| # | Issue | Severity | Category | Action |
|---|-------|----------|----------|--------|
| 1 | Social login password predictable | HIGH | Security | Apply HMAC + server secret salt |
| 2 | Kakao callback missing CSRF state | HIGH | Security | Add state like Naver/Google/Apple |
| 3 | Cognito callback httpOnly:false cookie | MED | Security | Unify to exchange code method |
| 4 | redirect_after_login Open Redirect | MED | Security | Allow internal paths only |
| 5 | check-login-method email enumeration | MED | Security | Add rate limiting |
| 6 | In-memory state/exchange store | MED | API | Switch to Redis for multi-server |
| 7 | page.tsx 1374-line single file | MED | Structure | Split into components |
| 8 | Login button missing disabled | LOW | UX | Add disabled={loading} |
| 9 | Password reset missing rule check | LOW | UX | Add same rules as signup |
| 10 | span+onClick accessibility issue | LOW | A11y | Change to button tag |
| 11 | Import statements scattered | LOW | Structure | Move all to top of file |

## Action Priority

1. **[IMMEDIATE]** Add CSRF state to Kakao callback
2. **[IMMEDIATE]** Add server secret salt to social login passwords
3. **[IMMEDIATE]** Validate redirect_after_login (internal paths only)
4. **[RECOMMENDED]** Add disabled={loading} to login button
5. **[PLANNED]** Unify Cognito callback to exchange code method
6. **[PLANNED]** Add rate limiting to check-login-method API
7. **[FUTURE]** Split page.tsx into separate components
8. **[FUTURE]** Migrate in-memory store to Redis for multi-server

---

## Step 1: Structure & Code Quality

### 1-1. Component structure not separated — MED
**Problem:** page.tsx is 1,374 lines. All views (login/signup/verify/password reset), 7 SVG icons, and all handlers are in a single file.
**Solution:** Split into: SocialIcons.tsx, LoginView.tsx, SignupView.tsx, ConfirmView.tsx, ForgotPasswordView.tsx, SocialLoginButtons.tsx. Not urgent but recommended before adding features.

### 1-2. Import statements scattered — LOW
**Problem:** Imports appear at lines 2-5 and again at lines 102-115.
**Solution:** Move all imports to the top of the file.

### 1-3. Excessive useState (20+) — LOW
**Problem:** LoginPageInner has 20+ useState hooks.
**Solution:** Consider consolidating with useReducer for related states.

### 1-4. Hardcoded values — LOW
**Problem:** Password suffix 'HealEcho2025' is hardcoded in callback patterns.
**Solution:** Extract password suffix to environment variable for easier rotation.

---

## Step 2: Security

### 2-1. Social login passwords are predictable — HIGH
**Problem:** Cognito passwords for social users are generated deterministically: Kk!{kakaoId}_HealEcho2025, Nv!{naverId}_HealEcho2025, etc. Social IDs are public or guessable. An attacker who knows a user's social ID can log into their Cognito account directly.
**Solution:** Add server-only secret salt using HMAC:
```javascript
const hash = crypto.createHmac('sha256', process.env.SOCIAL_PASSWORD_SALT)
  .update('kakao:{id}').digest('hex').substring(0,20);
```
Apply to all providers.

### 2-2. Kakao callback missing CSRF state — HIGH
**Problem:** Naver/Google/Apple all generate and verify OAuth state for CSRF protection, but Kakao login skips state entirely. An attacker could link a victim's account to the attacker's Kakao profile.
**Solution:** Add state parameter to Kakao login flow matching the pattern used by other providers. Update getKakaoLoginUrl(), state/route.ts, and kakao/callback/route.ts.

### 2-3. Cognito callback uses httpOnly:false cookies — MED
**Problem:** cognito/callback/route.ts sets cognito_id_token and cognito_access_token as httpOnly:false cookies. XSS attacks can read these tokens via JavaScript.
**Solution:** Unify Cognito callback to use the exchange code method already used by other social logins.

### 2-4. Token storage in localStorage — MED
**Problem:** All auth tokens are stored in localStorage via a storage abstraction layer. Any XSS vulnerability exposes all tokens.
**Solution:** Current structure is acceptable given: 1-hour JWT expiry, storage abstraction allows future migration, mobile app compatibility. Focus on strong XSS prevention (CSP headers, input validation).

### 2-5. check-login-method enables email enumeration — MED
**Problem:** /api/public/auth/check-login-method returns exists:true/false, revealing whether an email is registered.
**Solution:** Add rate limiting (5 requests per IP per minute).

### 2-6. redirect_after_login Open Redirect — MED
**Problem:** getPostLoginRedirect() passes sessionStorage value directly to router.replace() without validation.
**Solution:** Validate that redirect path starts with '/' and does not start with '//'. Default to '/home' otherwise.

---

## Step 3: API Design

### 3-1. API endpoint structure — OK
All 8 auth endpoints follow consistent RESTful naming with appropriate HTTP methods.

### 3-2. In-memory state/exchange store — MED
**Problem:** exchange/store.ts and state/store.ts use globalThis in-memory Maps. State created on one server instance cannot be verified on another.
**Solution:** Migrate to Redis when scaling to multiple server instances.

### 3-3. Exchange API has no rate limiting — LOW
**Problem:** Exchange codes are UUID-based, single-use, 60s TTL. Brute force unlikely but unlimited requests possible.
**Solution:** Consider basic rate limiting as defense-in-depth.

---

## Step 4: Error Handling & UX

### 4-1. Login failure UX — OK
Unified error messages maintain security. Password reset and signup guidance provided.

### 4-2. Loading states — OK
All form submissions show loading state with button text changes.

### 4-3. Banner notification system — OK
Success/error banners differentiated. Error banners have close buttons. Success banners auto-dismiss after 5 seconds.

### 4-4. Social login failure UX — OK
Each provider has specific error handling. Cancellation shows separate message. Error parameters auto-removed from URL.

### 4-5. Login button allows duplicate submissions — LOW
**Problem:** Signup button has disabled={loading} but login button does not.
**Solution:** Add disabled={loading} to the login submit button.

### 4-6. Password reset missing validation rules — LOW
**Problem:** Signup shows real-time password rules but password reset does not.
**Solution:** Apply the same password rule checker to the password reset form.

---

## Step 5: Performance

### 5-1. Re-rendering optimization — OK
showBanner memoized with useCallback. View transitions reset all states.

### 5-2. Image optimization — OK
Next.js Image component with WebP, responsive sizes, conditional mobile loading.

### 5-3. Bundle size — OK
Required dependencies only. Subscription module uses dynamic import. SVG icons inline.

### 5-4. Suspense boundary — OK
useSearchParams properly wrapped in Suspense boundary.

---

## Step 6: Responsive Design & Accessibility

### 6-1. Responsive breakpoints — OK
1025px+: split layout, 769-1024px: left 38%, <=768px: single column, <=480px: reduced spacing. Uses clamp(), safe-area-inset, 100dvh with fallback.

### 6-2. Keyboard accessibility — OK
Proper button/input tags, aria-label on social buttons and password toggle.

### 6-3. Accessibility improvements needed — LOW
**Problem:** Forgot password link and error block links use span+onClick (not keyboard accessible).
**Solution:** Change to button elements.

### 6-4. Motion reduction — OK
prefers-reduced-motion media query implemented.

### 6-5. Touch device hover handling — OK
@media (hover: none) prevents sticky hover states.

---

## Step 7: Mobile App Readiness

### 7-1. Storage abstraction layer — OK
@/lib/storage module allows swap to AsyncStorage with no other code changes.

### 7-2. JWT-based authentication — OK
No session-based logic. All JWT Bearer tokens, directly compatible with mobile.

### 7-3. API platform-agnostic design — OK
Auth APIs have no web-specific logic. Social callbacks are server-processed.

### 7-4. Exchange code mobile compatibility — OK
URL parameter + server memory exchange avoids cookie issues in in-app browsers.

**Note:** Native mobile social SDKs will need a separate token exchange API. Current architecture supports this extension.
