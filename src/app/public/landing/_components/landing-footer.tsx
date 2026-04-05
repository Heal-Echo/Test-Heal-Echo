import Image from "next/image";
import shared from "../shared.module.css";
import styles from "./landing-footer.module.css";
import { COMPANY_INFO } from "@/config/company";

export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${shared.container} ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Image
            src="/assets/images/webp/Logo_HealEcho.webp"
            alt="Heal Echo"
            width={36}
            height={36}
            sizes="36px"
            className={styles.footerLogo}
          />
          <span className={styles.footerBrandName}>Heal Echo</span>
        </div>

        <div className={styles.footerInfo} suppressHydrationWarning>
          <p>대표 : {COMPANY_INFO.ceo}</p>
          <p suppressHydrationWarning>사업자 등록 번호 : {COMPANY_INFO.businessNumber}</p>
          <p>통신판매업 신고 번호 : {COMPANY_INFO.salesRegistrationNumber}</p>
          <p>
            주소 : {COMPANY_INFO.addressLine1}
            <span className={shared.blockOnMobile}>{COMPANY_INFO.addressLine2}</span>
          </p>
        </div>

        <p className={styles.footerCopyright}>
          &copy; 2025 {COMPANY_INFO.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
