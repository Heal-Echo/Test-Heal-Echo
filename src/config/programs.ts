// src/config/programs.ts
// =======================================================
// 프로그램 정보 단일 소스 (Single Source of Truth)
// - 프로그램명, 설명, 이미지 경로를 한 곳에서 관리
// - 프로그램명 변경 시 이 파일만 수정하면 전체 반영
// =======================================================

export type ProgramInfo = {
  id: string;
  name: string;
  description: string;
  /** 기본 이미지 (pricing, home 등에서 사용) */
  image: string;
  /** 웰니스 내부 이미지 (solution, weekly-habit 팝업 등에서 사용) */
  imageAlt: string;
};

/** 전체 프로그램 정보 (id 기준 맵) */
export const PROGRAMS: Record<string, ProgramInfo> = {
  autobalance: {
    id: "autobalance",
    name: "기적의 오토 밸런스",
    description: "자율신경계 균형을 되찾는 맞춤 요가 클래스",
    image: "/assets/images/balance reset_square.png",
    imageAlt: "/assets/images/autobalance_square.png",
  },
  "womans-whisper": {
    id: "womans-whisper",
    name: "우먼즈 컨디션 케어",
    description: "여성 건강을 위한 호르몬 밸런스 요가",
    image: "/assets/images/woman condition_square.png",
    imageAlt: "/assets/images/womans_whisper_square.png",
  },
};

/** 배열 형태 (팝업·카드 목록 렌더링용) */
export const PROGRAMS_LIST: ProgramInfo[] = Object.values(PROGRAMS);

/**
 * programId → 한글 프로그램명 변환
 * - 관리자 페이지 회원목록, 구독 관리 등에서 사용
 * - 매칭되지 않으면 programId 원본 반환
 */
export function getProgramName(programId: string | undefined | null): string {
  if (!programId) return "-";
  return PROGRAMS[programId]?.name ?? programId;
}
