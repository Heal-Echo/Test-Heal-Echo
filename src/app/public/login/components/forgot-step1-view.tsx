import styles from "../login.module.css";
import { NaverSymbol, GoogleSymbol, AppleSymbol, KakaoSymbol } from "@/components/icons";

interface ForgotSocialInfo {
  message: string;
  method: string | null;
}

interface ForgotStep1ViewProps {
  viewKey: number;
  banner: React.ReactNode;
  forgotEmail: string;
  setForgotEmail: (v: string) => void;
  forgotSocialInfo: ForgotSocialInfo | null;
  setForgotSocialInfo: (v: ForgotSocialInfo | null) => void;
  isLoading: boolean;
  handleForgotStep1: (e: React.FormEvent) => void;
  handleKakaoLogin: () => void;
  handleNaverLogin: () => void;
  handleGoogleLogin: () => void;
  handleAppleLogin: () => void;
  switchView: (v: "login") => void;
}

export default function ForgotStep1View({
  viewKey,
  banner,
  forgotEmail,
  setForgotEmail,
  forgotSocialInfo,
  setForgotSocialInfo,
  isLoading,
  handleForgotStep1,
  handleKakaoLogin,
  handleNaverLogin,
  handleGoogleLogin,
  handleAppleLogin,
  switchView,
}: ForgotStep1ViewProps) {
  return (
    <div key={viewKey} className={styles.rightFrameContainer}>
      {banner}

      <h1 className={styles.bigTitle}>비밀번호 재설정</h1>

      <div className={styles.subtitleFrame}>
        <span className={styles.subtitleLeft}>이메일을 입력해 주세요</span>
        <button type="button" className={styles.subtitleRight} onClick={() => switchView("login")}>
          로그인으로 돌아가기
        </button>
      </div>

      <form className={styles.emailLoginBox} onSubmit={handleForgotStep1}>
        <input
          type="email"
          placeholder="이메일 주소"
          required
          aria-label="이메일 주소"
          className={`${styles.emailInput} ${forgotSocialInfo ? styles.inputError : ""}`}
          value={forgotEmail}
          onChange={(e) => {
            setForgotEmail(e.target.value);
            setForgotSocialInfo(null);
          }}
        />

        {/* 소셜 가입자 인라인 안내 */}
        {forgotSocialInfo && (
          <div className={styles.forgotSocialBlock}>
            <p className={styles.forgotSocialText}>
              {forgotSocialInfo.message.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && <br />}
                </span>
              ))}
            </p>

            {/* 해당 소셜 로그인 버튼 */}
            <div className={styles.forgotSocialButtons}>
              {forgotSocialInfo.method === "kakao" && (
                <button
                  type="button"
                  className={`${styles.socialLoginBtn} ${styles.socialLoginKakao}`}
                  onClick={handleKakaoLogin}
                >
                  <KakaoSymbol />
                  <span>카카오로 로그인</span>
                </button>
              )}
              {forgotSocialInfo.method === "naver" && (
                <button
                  type="button"
                  className={`${styles.socialLoginBtn} ${styles.socialLoginNaver}`}
                  onClick={handleNaverLogin}
                >
                  <NaverSymbol />
                  <span>네이버로 로그인</span>
                </button>
              )}
              {forgotSocialInfo.method === "google" && (
                <button
                  type="button"
                  className={`${styles.socialLoginBtn} ${styles.socialLoginGoogle}`}
                  onClick={handleGoogleLogin}
                >
                  <GoogleSymbol />
                  <span>구글로 로그인</span>
                </button>
              )}
              {forgotSocialInfo.method === "apple" && (
                <button
                  type="button"
                  className={`${styles.socialLoginBtn} ${styles.socialLoginApple}`}
                  onClick={handleAppleLogin}
                >
                  <AppleSymbol />
                  <span>애플로 로그인</span>
                </button>
              )}
              {/* method가 null이면 가입 경로 미상 → 전체 소셜 버튼 */}
              {forgotSocialInfo.method === null && (
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
                    aria-label="구글 로그인"
                    onClick={handleGoogleLogin}
                  >
                    <GoogleSymbol />
                  </button>
                  <button
                    type="button"
                    className={`${styles.socialIconBtn} ${styles.socialApple}`}
                    aria-label="애플 로그인"
                    onClick={handleAppleLogin}
                  >
                    <AppleSymbol />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!forgotSocialInfo && (
          <button type="submit" className={styles.continueButton} disabled={isLoading}>
            {isLoading ? "전송 중..." : "인증코드 받기"}
          </button>
        )}
      </form>
    </div>
  );
}
