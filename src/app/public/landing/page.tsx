import { Suspense } from "react";
import PublicHeader from "@/components/publicSite/public-header";
import styles from "./landing.module.css";

// 클라이언트 상태가 필요한 섹션만 클라이언트 컴포넌트로 분리
import HeroProgramsClient from "./hero-programs-client";
import IntroVideoClient from "./intro-video-client";

// 서버 섹션 컴포넌트
import BenefitSection from "./_components/benefit-section";
import EvidenceSection from "./_components/evidence-section";
import WhySection from "./_components/why-section";
import EmpathySection from "./_components/empathy-section";
import LandingFooter from "./_components/landing-footer";

// 서버 사이드 데이터 fetch
import { fetchIntroVideo } from "./_lib/fetch-intro-video";

export default async function LandingPage() {
  // 서버에서 비디오 데이터를 미리 가져옴 (ISR 캐싱 적용)
  const introVideoData = await fetchIntroVideo();

  return (
    <div className={styles.pageWrapper}>
      {/* 공통 헤더 */}
      <PublicHeader />

      <main>
        {/* Hero + Programs + ComingSoon 모달 (클라이언트) */}
        <Suspense
          fallback={
            <div
              style={{
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-busy="true"
            >
              <div className={styles.suspenseSpinner} role="status">
                <span className="sr-only">로딩 중...</span>
              </div>
            </div>
          }
        >
          <HeroProgramsClient />
        </Suspense>

        {/* Introduction Video (클라이언트 — 재생 제어만 담당) */}
        <Suspense
          fallback={
            <div
              style={{
                minHeight: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-busy="true"
            >
              <div className={styles.suspenseSpinner} role="status">
                <span className="sr-only">로딩 중...</span>
              </div>
            </div>
          }
        >
          <IntroVideoClient
            videoKey={introVideoData.videoKey}
            thumbnailKey={introVideoData.thumbnailKey}
            error={introVideoData.error}
          />
        </Suspense>

        {/* Member's Benefit (서버) */}
        <BenefitSection />

        {/* Research Evidence (서버) */}
        <EvidenceSection />

        {/* Why Heal Echo (서버) */}
        <WhySection />

        {/* Empathy (서버) */}
        <EmpathySection />
      </main>

      {/* Footer (서버) */}
      <LandingFooter />
    </div>
  );
}
