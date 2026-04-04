/** 사용자 프로필 데이터 (온보딩에서 수집) */
export interface UserProfile {
  wellnessGoal?: string;
  nickname?: string;
  dietHabit?: string;
  sleepTime?: string;
  wakeTime?: string;
  exerciseFrequency?: string;
  [key: string]: unknown;
}

/** GET /api/user/profile 응답 형태 (AWS Lambda) */
export interface ProfileResponse {
  profile?: UserProfile;
  profileSetupDone?: boolean;
  // 플랫 구조 fallback 필드 (Lambda 응답 형태에 따라)
  wellnessGoal?: string;
  nickname?: string;
  dietHabit?: string;
  [key: string]: unknown;
}
