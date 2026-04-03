import styles from "../login.module.css";
import {
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  CircleIcon,
} from "@/components/icons";

interface PwRule {
  label: string;
  pass: boolean;
}

interface ForgotStep2ViewProps {
  viewKey: number;
  banner: React.ReactNode;
  resetCode: string;
  setResetCode: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showResetPw: boolean;
  setShowResetPw: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirmPw: boolean;
  setShowConfirmPw: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  resetPwRules: PwRule[];
  allResetPwRulesPassed: boolean;
  handleForgotStep2: (e: React.FormEvent) => void;
  switchView: (v: "login") => void;
}

export default function ForgotStep2View({
  viewKey,
  banner,
  resetCode,
  setResetCode,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showResetPw,
  setShowResetPw,
  showConfirmPw,
  setShowConfirmPw,
  loading,
  resetPwRules,
  allResetPwRulesPassed,
  handleForgotStep2,
  switchView,
}: ForgotStep2ViewProps) {
  return (
    <div key={viewKey} className={styles.rightFrameContainer}>
      {banner}

      <h1 className={styles.bigTitle}>새 비밀번호 설정</h1>

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

      <form className={styles.emailLoginBox} onSubmit={handleForgotStep2}>
        <input
          type="text"
          placeholder="인증 코드"
          required
          className={styles.emailInput}
          value={resetCode}
          onChange={(e) => setResetCode(e.target.value)}
        />

        <div className={styles.passwordWrapper}>
          <input
            type={showResetPw ? "text" : "password"}
            placeholder="새 비밀번호 (8자 이상)"
            required
            className={styles.emailInput}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowResetPw((v) => !v)}
            tabIndex={-1}
            aria-label={showResetPw ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showResetPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* 비밀번호 유효성 실시간 체크 (재설정용) */}
        {newPassword.length > 0 && !allResetPwRulesPassed && (
          <div className={styles.pwRules}>
            {resetPwRules.map((rule) => (
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

        <div className={styles.passwordWrapper}>
          <input
            type={showConfirmPw ? "text" : "password"}
            placeholder="새 비밀번호 확인"
            required
            className={`${styles.emailInput} ${
              confirmPassword.length > 0 && newPassword !== confirmPassword
                ? styles.inputError
                : ""
            }`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirmPw((v) => !v)}
            tabIndex={-1}
            aria-label={showConfirmPw ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* 비밀번호 불일치 실시간 안내 */}
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <p className={styles.loginErrorText}>비밀번호가 일치하지 않습니다.</p>
        )}

        <button
          type="submit"
          className={styles.continueButton}
          disabled={
            !allResetPwRulesPassed ||
            (confirmPassword.length > 0 && newPassword !== confirmPassword)
          }
        >
          {loading ? "변경 중..." : "비밀번호 재설정"}
        </button>
      </form>
    </div>
  );
}
