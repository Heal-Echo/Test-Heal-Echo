"use client";

import Image from "next/image";
import styles from "./pricing.module.css";
import { PROGRAMS_LIST } from "@/config/programs";

interface ProgramSelectPopupProps {
  onClose: () => void;
  onSelectProgram: (programId: string) => void;
}

export default function ProgramSelectPopup({ onClose, onSelectProgram }: ProgramSelectPopupProps) {
  return (
    <div className={styles.programModalOverlay} onClick={onClose}>
      <div
        className={styles.programModalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="웰니스 프로그램 선택"
      >
        <span className={styles.programModalBadge}>7일 무료 체험</span>
        <p className={styles.programModalTitle}>나에게 맞는 웰니스 솔루션을 선택하세요</p>
        <p className={styles.programModalSub}>선택 즉시 카드 등록 화면으로 이동합니다</p>

        <div className={styles.programModalCards}>
          {PROGRAMS_LIST.map((prog) => (
            <button
              key={prog.id}
              className={styles.programModalCard}
              onClick={() => onSelectProgram(prog.id)}
            >
              <div className={styles.programModalImageWrap}>
                <Image
                  src={prog.image}
                  alt={prog.name}
                  width={320}
                  height={320}
                  className={styles.programModalImage}
                />
              </div>
              <span className={styles.programModalCardName}>{prog.name}</span>
              <span className={styles.programModalCardDesc}>{prog.description}</span>
              <span className={styles.programModalCardCta}>선택하기 →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
