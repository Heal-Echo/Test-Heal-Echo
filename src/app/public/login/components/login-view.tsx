import styles from "../login.module.css";
import TermsConsentCheckbox from "./terms-consent-checkbox";
import {
  EyeIcon,
  EyeOffIcon,
  NaverSymbol,
  GoogleSymbol,
  AppleSymbol,
  KakaoSymbol,
} from "@/components/icons";

interface LoginViewProps {
  viewKey: number;
  banner: React.ReactNode;
  // form state
  loginEmail: string;
  setLoginEmail: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginError: string;
  setLoginError: (v: string) => void;
  isLoginPwShown: boolean;
  setIsLoginPwShown: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  // terms
  hasTermsConsent: boolean;
  setHasTermsConsent: (v: boolean) => void;
  consentToastKey: number;
  // handlers
  handleLogin: (e: React.FormEvent) => void;
  handleKakaoLogin: () => void;
  handleNaverLogin: () => void;
  handleGoogleLogin: () => void;
  handleAppleLogin: () => void;
  switchView: (v: "signup" | "forgotStep1") => void;
}

export default function LoginView({
  viewKey,
  banner,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  setLoginError,
  isLoginPwShown,
  setIsLoginPwShown,
  isLoading,
  hasTermsConsent,
  setHasTermsConsent,
  consentToastKey,
  handleLogin,
  handleKakaoLogin,
  handleNaverLogin,
  handleGoogleLogin,
  handleAppleLogin,
  switchView,
}: LoginViewProps) {
  return (
    <div key={viewKey} className={styles.rightFrameContainer}>
      {banner}

      <h1 className={styles.bigTitle}>로그인</h1>

      <div className={styles.subtitleFrame}>
        <span className={styles.subtitleLeft}>처음 오셨나요?</span>
        <button type="button" className={styles.subtitleRight} onClick={() => switchView("signup")}>
          회원가입
        </button>
      </div>

      <form className={styles.emailLoginBox} onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="이메일 주소"
          required
          aria-label="이메일 주소"
          className={`${styles.emailInput} ${loginError ? styles.inputError : ""}`}
          value={loginEmail}
          onChange={(e) => {
            setLoginEmail(e.target.value);
            setLoginError("");
          }}
        />

        <div className={styles.passwordWrapper}>
          <input
            type={isLoginPwShown ? "text" : "password"}
            placeholder="비밀번호"
            required
            aria-label="비밀번호"
            className={`${styles.emailInput} ${loginError ? styles.inputError : ""}`}
            value={loginPassword}
            onChange={(e) => {
              setLoginPassword(e.target.value);
              setLoginError("");
            }}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsLoginPwShown((v) => !v)}
            tabIndex={-1}
            aria-label={isLoginPwShown ? "비밀번호 숨��기" : "비밀번호 보기"}
          >
            {isLoginPwShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {loginError && (
          <div className={styles.loginErrorBlock}>
            <p className={styles.loginErrorText}>{loginError}</p>
            <div className={styles.loginErrorLinks}>
              <button
                type="button"
                className={styles.loginErrorLink}
                onClick={() => switchView("forgotStep1")}
              >
                비밀번호를 잊��셨나요?
              </button>
              <span className={styles.loginErrorDot}>·</span>
              <button
                type="button"
                className={styles.loginErrorLink}
                onClick={() => switchView("signup")}
              >
                계정이 없으신가요? 회원가입
              </button>
            </div>
          </div>
        )}

        {!loginError && (
          <button
            type="button"
            className={styles.forgotPassword}
            onClick={() => switchView("forgotStep1")}
          >
            비밀번호 찾기
          </button>
        )}

        <button type="submit" className={styles.continueButton} disabled={isLoading}>
          {isLoading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      {/* 구분선 + 소셜 로그인 아이콘 */}
      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>또는</span>
        <span className={styles.dividerLine} />
      </div>

      {/* 소셜 로그인용 약관 동의 체크박스 */}
      <TermsConsentCheckbox
        checked={hasTermsConsent}
        onChange={setHasTermsConsent}
        consentToastKey={consentToastKey}
      />

      <div className={styles.socialIcons}>
        <button
          type="button"
          className={`${styles.socialIconBtn} ${styles.socialKakao}`}
          aria-label="카카오 로그인"
          onClick={handleKakaoLogin}
        >
          <KakaoSymbol />
        </button>
        <button
          type="button"
          className={`${styles.socialIconBtn} ${styles.socialNaver}`}
          aria-label="네이버 로그인"
          onClick={handleNaverLogin}
        >
          <NaverSymbol />
        </button>
        <button
          type="button"
          className={`${styles.socialIconBtn} ${styles.socialGoogle}`}
          aria-label="구글 로��인"
          onClick={handleGoogleLogin}
        >
          <GoogleSymbol />
        </button>
        <button
          type="button"
          className={`${styles.socialIconBtn} ${styles.socialApple}`}
          aria-label="애플 로��인"
          onClick={handleAppleLogin}
        >
          <AppleSymbol />
        </button>
      </div>
    </div>
  );
}
