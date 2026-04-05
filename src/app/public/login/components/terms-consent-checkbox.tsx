import styles from "../login.module.css";

interface TermsConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  consentToastKey: number;
  className?: string;
}

export default function TermsConsentCheckbox({
  checked,
  onChange,
  consentToastKey,
  className,
}: TermsConsentCheckboxProps) {
  return (
    <div className={`${styles.consentGroup} ${className ?? ""}`}>
      {consentToastKey > 0 && (
        <div key={consentToastKey} className={styles.consentBubble}>
          필수 동의 항목에 동의해주세요
        </div>
      )}
      <label className={styles.consentLabel}>
        <input
          type="checkbox"
          className={styles.consentCheckbox}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.consentText}>
          <span className={styles.consentBadge}>(필수)</span> 이용약관 및 개인정보 수집·이용에
          동의합니다.{" "}
          <a
            href="/public/terms"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.consentViewLink}
            onClick={(e) => e.stopPropagation()}
            aria-label="이용약관 전문보기 (새 창에서 열림)"
          >
            전문보기
          </a>
        </span>
      </label>
    </div>
  );
}
