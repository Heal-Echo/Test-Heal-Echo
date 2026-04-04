import styles from "../login.module.css";

interface ConfirmViewProps {
  viewKey: number;
  banner: React.ReactNode;
  verifyCode: string;
  setVerifyCode: (v: string) => void;
  isLoading: boolean;
  handleConfirmSignup: (e: React.FormEvent) => void;
  switchView: (v: "login") => void;
}

export default function ConfirmView({
  viewKey,
  banner,
  verifyCode,
  setVerifyCode,
  isLoading,
  handleConfirmSignup,
  switchView,
}: ConfirmViewProps) {
  return (
    <div key={viewKey} className={styles.rightFrameContainer}>
      {banner}

      <h1 className={styles.bigTitle}>이메일 인증</h1>

      <div className={styles.subtitleFrame}>
        <span className={styles.subtitleLeft}></span>
        <button
          type="button"
          className={styles.subtitleRight}
          onClick={() => switchView("login")}
        >
          로그인으로 돌아가기
        </button>
      </div>

      <form className={styles.emailLoginBox} onSubmit={handleConfirmSignup}>
        <input
          type="text"
          placeholder="인증 코드"
          required
          aria-label="인증 코드"
          className={styles.emailInput}
          value={verifyCode}
          onChange={(e) => setVerifyCode(e.target.value)}
        />
        <button type="submit" className={styles.continueButton} disabled={isLoading}>
          {isLoading ? "확인 중..." : "인증 확인"}
        </button>
      </form>
    </div>
  );
}
