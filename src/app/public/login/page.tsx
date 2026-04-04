"use client";
import { Suspense } from "react";
import Image from "next/image";
import PublicHeader from "@/components/publicSite/PublicHeader";
import styles from "./login-page.module.css";
import { useLoginPage } from "./use-login-page";
import LoginView from "./components/login-view";
import SignupView from "./components/signup-view";
import ConfirmView from "./components/confirm-view";
import ForgotStep1View from "./components/forgot-step1-view";
import ForgotStep2View from "./components/forgot-step2-view";
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const s = useLoginPage();
  const renderBanner = () => {
    if (!s.banner) return null;
    return (
      <div
        className={`${styles.banner} ${
          s.banner.type === "success" ? styles.bannerSuccess : styles.bannerError
        }`}
      >
        <span className={styles.bannerMessage}>{s.banner.message}</span>
        {s.banner.type === "error" && (
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => s.setBanner(null)}
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>
    );
  };
  return (
    <>
      <PublicHeader />
      <main className={styles.loginPage}>
        {s.isSocialCallbackLoading && (
          <div className={styles.socialCallbackOverlay} aria-live="polite">
            <div className={styles.socialCallbackSpinner} />
            <p className={styles.socialCallbackText}>로그인 처리 중...</p>
          </div>
        )}
        <div className={styles.mainContent}>
          <section className={styles.leftFrame}>
            <Image
              src="/assets/images/webp/wellness.webp"
              alt=""
              role="presentation"
              fill
              sizes="(max-width: 768px) 0px, 45vw"
              className={styles.leftBgImage}
            />
            <div className={styles.leftContent}>
              <Image
                src="/assets/images/webp/Logo_HealEcho.webp"
                alt="Heal Echo"
                width={80}
                height={80}
                className={styles.leftLogo}
              />
              <h2 className={styles.leftBrand}>Heal Echo</h2>
              <p className={styles.leftSlogan}>
                하루 15분,<br />
                당신을 위한 맞춤 웰니스 솔루션
              </p>
              <div className={styles.leftAccent} />
            </div>
          </section>
          <section className={styles.rightFrame}>
            {s.view === "login" && (
              <LoginView
                viewKey={s.viewKey}
                banner={renderBanner()}
                loginEmail={s.loginEmail}
                setLoginEmail={s.setLoginEmail}
                loginPassword={s.loginPassword}
                setLoginPassword={s.setLoginPassword}
                loginError={s.loginError}
                setLoginError={s.setLoginError}
                isLoginPwShown={s.isLoginPwShown}
                setIsLoginPwShown={s.setIsLoginPwShown}
                isLoading={s.isLoading}
                hasTermsConsent={s.hasTermsConsent}
                setHasTermsConsent={s.setHasTermsConsent}
                consentToastKey={s.consentToastKey}
                handleLogin={s.handleLogin}
                handleKakaoLogin={s.handleKakaoLogin}
                handleNaverLogin={s.handleNaverLogin}
                handleGoogleLogin={s.handleGoogleLogin}
                handleAppleLogin={s.handleAppleLogin}
                switchView={s.switchView}
              />
            )}
            {s.view === "signup" && (
              <SignupView
                viewKey={s.viewKey}
                banner={renderBanner()}
                signupFamilyName={s.signupFamilyName}
                setSignupFamilyName={s.setSignupFamilyName}
                signupGivenName={s.signupGivenName}
                setSignupGivenName={s.setSignupGivenName}
                signupEmail={s.signupEmail}
                setSignupEmail={s.setSignupEmail}
                signupPassword={s.signupPassword}
                setSignupPassword={s.setSignupPassword}
                signupPwConfirm={s.signupPwConfirm}
                setSignupPwConfirm={s.setSignupPwConfirm}
                isSignupPwConfirmTouched={s.isSignupPwConfirmTouched}
                setIsSignupPwConfirmTouched={s.setIsSignupPwConfirmTouched}
                isSignupPwShown={s.isSignupPwShown}
                setIsSignupPwShown={s.setIsSignupPwShown}
                isSignupPwConfirmShown={s.isSignupPwConfirmShown}
                setIsSignupPwConfirmShown={s.setIsSignupPwConfirmShown}
                isSignupPwFocused={s.isSignupPwFocused}
                setIsSignupPwFocused={s.setIsSignupPwFocused}
                isLoading={s.isLoading}
                pwRules={s.pwRules}
                allPwRulesPassed={s.allPwRulesPassed}
                isPwRulesHidden={s.isPwRulesHidden}
                isPwRulesFading={s.isPwRulesFading}
                hasTermsConsent={s.hasTermsConsent}
                setHasTermsConsent={s.setHasTermsConsent}
                consentToastKey={s.consentToastKey}
                handleSignup={s.handleSignup}
                handleKakaoLogin={s.handleKakaoLogin}
                handleNaverLogin={s.handleNaverLogin}
                handleGoogleLogin={s.handleGoogleLogin}
                handleAppleLogin={s.handleAppleLogin}
                switchView={s.switchView}
              />
            )}
            {s.view === "confirm" && (
              <ConfirmView
                viewKey={s.viewKey}
                banner={renderBanner()}
                verifyCode={s.verifyCode}
                setVerifyCode={s.setVerifyCode}
                isLoading={s.isLoading}
                handleConfirmSignup={s.handleConfirmSignup}
                switchView={s.switchView}
              />
            )}
            {s.view === "forgotStep1" && (
              <ForgotStep1View
                viewKey={s.viewKey}
                banner={renderBanner()}
                forgotEmail={s.forgotEmail}
                setForgotEmail={s.setForgotEmail}
                forgotSocialInfo={s.forgotSocialInfo}
                setForgotSocialInfo={s.setForgotSocialInfo}
                isLoading={s.isLoading}
                handleForgotStep1={s.handleForgotStep1}
                handleKakaoLogin={s.handleKakaoLogin}
                handleNaverLogin={s.handleNaverLogin}
                handleGoogleLogin={s.handleGoogleLogin}
                handleAppleLogin={s.handleAppleLogin}
                switchView={s.switchView}
              />
            )}
            {s.view === "forgotStep2" && (
              <ForgotStep2View
                viewKey={s.viewKey}
                banner={renderBanner()}
                resetCode={s.resetCode}
                setResetCode={s.setResetCode}
                newPassword={s.newPassword}
                setNewPassword={s.setNewPassword}
                confirmPassword={s.confirmPassword}
                setConfirmPassword={s.setConfirmPassword}
                isResetPwShown={s.isResetPwShown}
                setIsResetPwShown={s.setIsResetPwShown}
                isConfirmPwShown={s.isConfirmPwShown}
                setIsConfirmPwShown={s.setIsConfirmPwShown}
                isLoading={s.isLoading}
                resetPwRules={s.resetPwRules}
                allResetPwRulesPassed={s.allResetPwRulesPassed}
                handleForgotStep2={s.handleForgotStep2}
                switchView={s.switchView}
              />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
