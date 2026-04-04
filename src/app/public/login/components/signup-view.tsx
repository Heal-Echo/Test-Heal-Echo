import styles from "../login.module.css";
import TermsConsentCheckbox from "./terms-consent-checkbox";
import {
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  CircleIcon,
  NaverSymbol,
  GoogleSymbol,
  AppleSymbol,
  KakaoSymbol,
} from "@/components/icons";

interface PwRule {
  label: string;
  pass: boolean;
}

interface SignupViewProps {
  viewKey: number;
  banner: React.ReactNode;
  // form state
  signupFamilyName: string;
  setSignupFamilyName: (v: string) => void;
  signupGivenName: string;
  setSignupGivenName: (v: string) => void;
  signupEmail: string;
  setSignupEmail: (v: string) => void;
  signupPassword: string;
  setSignupPassword: (v: string) => void;
  signupPwConfirm: string;
  setSignupPwConfirm: (v: string) => void;
  isSignupPwConfirmTouched: boolean;
  setIsSignupPwConfirmTouched: (v: boolean) => void;
  isSignupPwShown: boolean;
  setIsSignupPwShown: React.Dispatch<React.SetStateAction<boolean>>;
  isSignupPwConfirmShown: boolean;
  setIsSignupPwConfirmShown: React.Dispatch<React.SetStateAction<boolean>>;
  isSignupPwFocused: boolean;
  setIsSignupPwFocused: (v: boolean) => void;
  isLoading: boolean;
  // password rules
  pwRules: PwRule[];
  allPwRulesPassed: boolean;
  isPwRulesHidden: boolean;
  isPwRulesFading: boolean;
  // terms
  hasTermsConsent: boolean;
  setHasTermsConsent: (v: boolean) => void;
  consentToastKey: number;
  // handlers
  handleSignup: (e: React.FormEvent) => void;
  handleKakaoLogin: () => void;
  handleNaverLogin: () => void;
  handleGoogleLogin: () => void;
  handleAppleLogin: () => void;
  switchView: (v: "login") => void;
}

export default function SignupView({
  viewKey,
  banner,
  signupFamilyName,
  setSignupFamilyName,
  signupGivenName,
  setSignupGivenName,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupPwConfirm,
  setSignupPwConfirm,
  isSignupPwConfirmTouched,
  setIsSignupPwConfirmTouched,
  isSignupPwShown,
  setIsSignupPwShown,
  isSignupPwConfirmShown,
  setIsSignupPwConfirmShown,
  isSignupPwFocused,
  setIsSignupPwFocused,
  isLoading,
  pwRules,
  allPwRulesPassed,
  isPwRulesHidden,
  isPwRulesFading,
  hasTermsConsent,
  setHasTermsConsent,
  consentToastKey,
  handleSignup,
  handleKakaoLogin,
  handleNaverLogin,
  handleGoogleLogin,
  handleAppleLogin,
  switchView,
}: SignupViewProps) {
  return (
    <div key={viewKey} className={styles.rightFrameContainer}>
      {banner}

      <h1 className={styles.bigTitle}>회원 가입</h1>

      <div className={styles.subtitleFrame}>
        <span className={styles.subtitleLeft}>이미 회원이신가요?</span>
        <button
          type="button"
          className={styles.subtitleRight}
          onClick={() => switchView("login")}
        >
          로그인
        </button>
      </div>

      <form className={styles.emailLoginBox} onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="성 (필수)"
          required
          className={styles.emailInput}
          value={signupFamilyName}
          onChange={(e) => setSignupFamilyName(e.target.value)}
        />
        <input
          type="text"
          placeholder="이름 (필수)"
          required
          className={styles.emailInput}
          value={signupGivenName}
          onChange={(e) => setSignupGivenName(e.target.value)}
        />
        <input
          type="email"
          placeholder="이메일 주소 (필수)"
          required
          className={styles.emailInput}
          value={signupEmail}
          onChange={(e) => setSignupEmail(e.target.value)}
        />

        <div className={styles.passwordWrapper}>
          <input
            type={isSignupPwShown ? "text" : "password"}
            placeholder="비밀번호 (8자 이상)"
            required
            className={styles.emailInput}
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            onFocus={() => setIsSignupPwFocused(true)}
            onBlur={() => setIsSignupPwFocused(false)}
            aria-describedby="signup-pw-rules"
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsSignupPwShown((v) => !v)}
            tabIndex={-1}
            aria-label={isSignupPwShown ? "���밀번호 숨기���" : "비밀번호 보기"}
          >
            {isSignupPwShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* 비밀번호 유효성 실시간 체크 */}
        {(isSignupPwFocused || signupPassword.length > 0) && !isPwRulesHidden && (
          <div id="signup-pw-rules" className={`${styles.pwRules} ${isPwRulesFading ? styles.pwRulesFadeOut : ""}`}>
            {pwRules.map((rule) => (
              <div
                key={rule.label}
                className={`${styles.pwRule} ${
                  rule.pass ? styles.pwRulePass : styles.pwRuleFail
                }`}
              >
                {rule.pass ? <CheckCircleIcon /> : <CircleIcon />}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 비밀번호 확인 */}
        <div className={styles.passwordWrapper}>
          <input
            type={isSignupPwConfirmShown ? "text" : "password"}
            placeholder="비���번호 확인"
            required
            className={`${styles.emailInput} ${
              isSignupPwConfirmTouched && signupPwConfirm.length > 0 && signupPassword !== signupPwConfirm
                ? styles.inputMismatch
                : ""
            }`}
            value={signupPwConfirm}
            onChange={(e) => {
              setSignupPwConfirm(e.target.value);
              if (!isSignupPwConfirmTouched) setIsSignupPwConfirmTouched(true);
            }}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsSignupPwConfirmShown((v) => !v)}
            tabIndex={-1}
            aria-label={isSignupPwConfirmShown ? "비밀���호 숨기기" : "비밀번�� 보기"}
          >
            {isSignupPwConfirmShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {isSignupPwConfirmTouched && signupPwConfirm.length > 0 && signupPassword !== signupPwConfirm && (
          <p className={styles.pwMismatch}>비밀번호가 일치하지 않습니다</p>
        )}

        {/* 약관 동의 체크박스 */}
        <TermsConsentCheckbox
          checked={hasTermsConsent}
          onChange={setHasTermsConsent}
          consentToastKey={consentToastKey}
        />

        <button
          type="submit"
          className={styles.continueButton}
          disabled={isLoading || !allPwRulesPassed}
        >
          {isLoading ? "처리 중..." : "회원가입"}
        </button>
      </form>

      {/* 구분선 + 소셜 회원가입 아이콘 */}
      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>또는</span>
        <span className={styles.dividerLine} />
      </div>

      <div className={styles.socialIcons}>
        <button type="button" className={`${styles.socialIconBtn} ${styles.socialKakao}`} aria-label="카카오 회원가��" onClick={handleKakaoLogin}>
          <KakaoSymbol />
        </button>
        <button type="button" className={`${styles.socialIconBtn} ${styles.socialNaver}`} aria-label="��이버 회원가입" onClick={handleNaverLogin}>
          <NaverSymbol />
        </button>
        <button type="button" className={`${styles.socialIconBtn} ${styles.socialGoogle}`} aria-label="구글 회원가입" onClick={handleGoogleLogin}>
          <GoogleSymbol />
        </button>
        <button type="button" className={`${styles.socialIconBtn} ${styles.socialApple}`} aria-label="애플 회원가입" onClick={handleAppleLogin}>
          <AppleSymbol />
        </button>
      </div>
    </div>
  );
}
