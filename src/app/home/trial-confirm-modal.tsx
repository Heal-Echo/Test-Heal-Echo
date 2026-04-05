"use client";

import styles from "./trial-confirm-modal.module.css";

interface TrialConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TrialConfirmModal({ open, onConfirm, onCancel }: TrialConfirmModalProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🧘‍♀️</div>
        <span className={styles.badge}>7일 무료 체험</span>
        <h3 className={styles.title}>
          기적의 오토 밸런스
          <br />
          7일 무료 체험이 시작됩니다
        </h3>
        <p className={styles.subtitle}>지금 바로 나만의 웰니스 여정을 시작해 보세요</p>
        <div className={styles.buttons}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            취소
          </button>
          <button type="button" className={styles.confirmButton} onClick={onConfirm}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
