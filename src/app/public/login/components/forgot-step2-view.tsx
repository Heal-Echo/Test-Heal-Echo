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
  isResetPwShown: boolean;
  setIsResetPwShown: React.Dispatch<React.SetStateAction<boolean>>;
  isConfirmPwShown: boolean;
  setIsConfirmPwShown: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
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
  isResetPwShown,
  setIsResetPwShown,
  isConfirmPwShown,
  setIsConfirmPwShown,
  isLoading,
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
            type={isResetPwShown ? "text" : "password"}
            placeholder="새 비밀번호 (8자 이상)"
            required
            className={styles.emailInput}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsResetPwShown((v) => !v)}
            tabIndex={-1}
            aria-label={isResetPwShown ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {isResetPwShown ? <EyeOffIcon /> : <EyeIcon />}
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
            type={isConfirmPwShown ? "text" : "password"}
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
            onClick={() => setIsConfirmPwShown((v) => !v)}
            tabIndex={-1}
            aria-label={isConfirmPwShown ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {isConfirmPwShown ? <EyeOffIcon /> : <EyeIcon />}
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
            isLoading ||
            !allResetPwRulesPassed ||
            (confirmPassword.length > 0 && newPassword !== confirmPassword)
          }
        >
          {isLoading ? "변경 중..." : "비밀번호 재설정"}
        </button>
      </form>
    </div>
  );
}
