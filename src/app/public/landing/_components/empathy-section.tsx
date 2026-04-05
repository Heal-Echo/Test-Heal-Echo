import Image from "next/image";
import Link from "next/link";
import shared from "../shared.module.css";
import styles from "./empathy-section.module.css";
import { ROUTES } from "@/config/routes";

export default function EmpathySection() {
  return (
    <section className={styles.empathySection}>
      <div className={shared.container}>
        <div className={styles.empathyFrame}>
          <div className={styles.empathyItem}>
            <div className={styles.empathyAvatar}>
              <Image
                src="/assets/images/webp/sadness.webp"
                alt="스트레스로 지친 표정"
                width={240}
                height={240}
                sizes="110px"
              />
            </div>
            <p className={styles.empathyText}>
              나도 모르게 시작된
              <br />
              몸과 마음의 불균형,
              <br />
              언제까지 견디기만 할 건가요?
            </p>
          </div>

          <div className={styles.empathySpacer} />

          <div className={styles.empathyItem}>
            <div className={styles.empathyAvatar}>
              <Image
                src="/assets/images/webp/smile.webp"
                alt="편안하게 미소짓는 표정"
                width={240}
                height={240}
                sizes="110px"
              />
            </div>
            <p className={styles.empathyText}>
              당신은 지금 당장
              <br />
              편안한 몸과 마음을
              <br />
              되찾을 수 있습니다.
            </p>
          </div>

          <Link className={styles.empathyCta} href={ROUTES.LOGIN}>
            지금, 나를 위한 변화 시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}
