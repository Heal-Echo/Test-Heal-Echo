"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";
import { getProgramName } from "@/config/programs";
import { syncProgramSelection } from "@/lib/programSelection";

interface ProgramSelectModalProps {
  onClose: () => void;
  onShowComingSoon: () => void;
}

export default function ProgramSelectModal({
  onClose,
  onShowComingSoon,
}: ProgramSelectModalProps) {
  const router = useRouter();

  /* ESC 키로 닫기 */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="웰니스 프로그램 선택"
      >
        <span className={styles.modalBadge}>7일 무료 체험</span>
        <p className={styles.modalTitle}>나에게 맞는 웰니스를 선택하세요</p>
        <p className={styles.modalSubText}>선택 즉시 맞춤 프로그램이 시작됩니다</p>

        <div className={styles.modalCards}>
          <button
            className={styles.modalCard}
            onClick={() => {
              syncProgramSelection("autobalance");
              onClose();
              router.push("/wellness/balance");
            }}
          >
            <div className={styles.modalCardImageWrap}>
              <Image
                src="/assets/images/webp/balance_reset_square.webp"
                alt={getProgramName("autobalance")}
                width={320}
                height={213}
                sizes="(max-width: 480px) 35vw, 160px"
                className={styles.modalCardImage}
              />
            </div>
            <span className={styles.modalCardName}>{getProgramName("autobalance")}</span>
            <span className={styles.modalCardCta}>시작하기 →</span>
          </button>

          <button
            className={styles.modalCard}
            onClick={() => {
              onClose();
              onShowComingSoon();
            }}
          >
            <div className={styles.modalCardImageWrap}>
              <Image
                src="/assets/images/webp/woman_condition_square.webp"
                alt={getProgramName("womans-whisper")}
                width={320}
                height={213}
                sizes="(max-width: 480px) 35vw, 160px"
                className={styles.modalCardImage}
              />
            </div>
            <span className={styles.modalCardName}>
              {getProgramName("womans-whisper")}
            </span>
            <span className={styles.modalCardCta}>시작하기 →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
