import { Suspense } from "react";
import Image from "next/image";
import PublicHeader from "@/components/publicSite/PublicHeader";
import styles from "./landing.module.css";

// 클라이언트 상태가 필요한 섹션만 클라이언트 컴포넌트로 분리
import HeroProgramsClient from "./HeroProgramsClient";
import IntroVideoClient from "./IntroVideoClient";

// ================================================
// 서버 사이드: Introduction 비디오 데이터 fetch
// API Gateway 직접 호출 → 클라이언트 네트워크 왕복 제거
// revalidate: 3600 → 1시간 ISR 캐싱
// ================================================
function resolveUpstreamUrl(): string | null {
  const directUrl = process.env.PUBLIC_INTRO_VIDEOS_URL;
  if (directUrl && directUrl.trim().length > 0) {
    return directUrl.trim();
  }

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_GATEWAY_URL ||
    process.env.ADMIN_API_GATEWAY_URL;

  if (!base) return null;

  return `${base.replace(/\/$/, "")}/public/videos`;
}

type VideoItem = {
  id: string;
  key: string;
  thumbnailKey?: string | null;
};

async function fetchIntroVideo(): Promise<{
  videoKey: string | null;
  thumbnailKey: string | null;
  error: string | null;
}> {
  try {
    const url = resolveUpstreamUrl();
    if (!url) {
      console.error("[Landing] Upstream URL not configured.");
      return { videoKey: null, thumbnailKey: null, error: "소개 영상을 불러올 수 없습니다." };
    }

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // 1시간 ISR 캐싱
    });

    if (!res.ok) {
      console.error("[Landing] Upstream returned:", res.status);
      return { videoKey: null, thumbnailKey: null, error: "소개 영상을 불러오는 중 문제가 발생했습니다." };
    }

    const data = await res.json();
    const items: VideoItem[] = data?.items ?? [];
    const FEATURED_VIDEO_ID = "featured";
    const match = items.find((v) => v.id === FEATURED_VIDEO_ID);

    if (!match) {
      return { videoKey: null, thumbnailKey: null, error: null };
    }

    return {
      videoKey: match.key,
      thumbnailKey: match.thumbnailKey ?? null,
      error: null,
    };
  } catch (err) {
    console.error("[Landing] Failed to fetch intro video:", err);
    return { videoKey: null, thumbnailKey: null, error: "소개 영상을 불러오는 중 문제가 발생했습니다." };
  }
}

export default async function LandingPage() {
  // 서버에서 비디오 데이터를 미리 가져옴 (ISR 캐싱 적용)
  const introVideoData = await fetchIntroVideo();

  return (
    <div className={styles.pageWrapper}>
      {/* 공통 헤더 */}
      <PublicHeader />

      {/* Hero + Programs + ComingSoon 모달 (클라이언트) */}
      <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
        <HeroProgramsClient />
      </Suspense>

      {/* Introduction Video (클라이언트 — 재생 제어만 담당) */}
      <Suspense fallback={<div style={{ minHeight: "200px" }} />}>
        <IntroVideoClient
          videoKey={introVideoData.videoKey}
          thumbnailKey={introVideoData.thumbnailKey}
          error={introVideoData.error}
        />
      </Suspense>

      {/* ===========================
          Member's Benefit (서버)
      ============================ */}
      <section id="member-benefit" className={styles.benefitSection}>
        <div className={styles.container}>
          <div className={styles.benefitHead}>
            <p className={styles.eyebrowPink}>Member&#39;s Benefit</p>
            <h2 className={styles.sectionTitle}>
              <span className={styles.benefitTitleAccent}>힐에코</span>의
              &#39;<span className={styles.benefitTitleHighlight}>맞춤 웰니스 3세트</span>&#39;
            </h2>
            <p className={styles.benefitSub}>
              힐에코의 웰니스 솔루션은 &#39;맞춤 웰니스 3세트&#39;로 구성됩니다.
            </p>
            <p className={styles.benefitSub}>
              &#39;위클리 솔루션과 위클리 해빗&#39;은 솔루션별로 내용이 상이합니다.
            </p>
          </div>

          <ul className={styles.benefitCards}>
            {/* 1. 위클리 솔루션 */}
            <li className={styles.benefitCardWrap}>
              <div className={styles.benefitCard}>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/webp/solutions.webp"
                    alt="위클리 솔루션"
                    width={800}
                    height={533}
                    sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                    className={styles.benefitImage}
                  />
                </div>
                <h3 className={styles.benefitTitle}>위클리 솔루션</h3>
                <p className={styles.benefitDesc}>
                  솔루션별 가장 효과적인
                  <span className={styles.blockOnMobile}>맞춤 효과 클래스</span>
                </p>
              </div>
            </li>

            {/* 2. 위클리 해빗 */}
            <li className={styles.benefitCardWrap}>
              <div className={styles.benefitCard}>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/webp/healing_recipe_square.webp"
                    alt="위클리 해빗"
                    width={800}
                    height={533}
                    sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                    className={styles.benefitImage}
                  />
                </div>
                <h3 className={styles.benefitTitle}>위클리 해빗</h3>
                <p className={styles.benefitDesc}>
                  쉽게 실천 가능한
                  <span className={styles.blockOnMobile}>수면 습관과 식습관</span>
                </p>
              </div>
            </li>

            {/* 3. 이해의 바다 */}
            <li className={styles.benefitCardWrap}>
              <div className={styles.benefitCard}>
                <div className={styles.benefitImageWrap}>
                  <Image
                    src="/assets/images/webp/Ocean_of_Understanding_crop.webp"
                    alt="이해의 바다"
                    width={800}
                    height={533}
                    sizes="(max-width: 480px) 45vw, (max-width: 640px) 40vw, (max-width: 1024px) 33vw, 280px"
                    className={styles.benefitImage}
                  />
                </div>
                <h3 className={styles.benefitTitle}>이해의 바다</h3>
                <p className={styles.benefitDesc}>
                  조건없이
                  <span className={styles.blockOnMobile}>나를 이해하는 시간</span>
                </p>
              </div>
            </li>
          </ul>

          <div className={styles.benefitNoteBox}>
            <p className={styles.benefitNote}>
              ※ 솔루션들은 <strong>단계별로 차근차근 오픈</strong>되어
              <span className={styles.blockOnMobile}>매우 따라하기 쉽습니다.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ===========================
          Research Evidence (서버)
      ============================ */}
      <section className={styles.evidenceSection}>
        <div className={styles.container}>
          <h2 className={styles.evidenceTitle}>
            힐에코의 맞춤 웰니스 3세트,
            <br />
            과학이 증명합니다
          </h2>

          <div className={styles.evidenceList}>
            {/* 1. 69% */}
            <div className={styles.evidenceItem}>
              <span className={styles.evidenceNumber}>69%</span>
              <div className={styles.evidenceBody}>
                <p className={styles.evidenceDesc}>
                  주 2~3회 요가 수련자는
                  <span className={styles.blockOnMobile}>대조군 대비 69%의 스트레스 지수 감소</span>
                </p>
                <p className={styles.evidenceSource}>
                  Frontiers in Psychiatry, 2024 — 13건 RCT, 1,026명 메타분석
                </p>
                <p className={styles.evidenceLink}>
                  → 힐에코의 위클리 솔루션은 주 3회,
                  <span className={styles.blockOnMobile}>하루 15분 맞춤 요가 클래스를 제공합니다</span>
                </p>
              </div>
            </div>

            {/* 2. 43% */}
            <div className={styles.evidenceItem}>
              <span className={styles.evidenceNumber}>43%</span>
              <div className={styles.evidenceBody}>
                <p className={styles.evidenceDesc}>
                  수면 습관 교육만으로 8주 만에 수면의 질 점수 43% 개선
                </p>
                <p className={styles.evidenceSource}>
                  TPM, 2025 — RCT, 140명, 8주간
                </p>
                <p className={styles.evidenceLink}>
                  → 힐에코의 위클리 해빗은 매주 실천 가능한 수면·식습관을 설계합니다
                </p>
              </div>
            </div>

            {/* 3. 56건 */}
            <div className={styles.evidenceItem}>
              <span className={styles.evidenceNumber}>
                56<span className={styles.evidenceNumberUnit}>건</span>
              </span>
              <div className={styles.evidenceBody}>
                <p className={styles.evidenceDesc}>
                  자기 이해 훈련 — 스트레스·불안 감소 효과 &#39;중간 이상&#39; 확인
                </p>
                <p className={styles.evidenceSource}>
                  Mindfulness, 2023 — 56건 RCT 메타분석
                </p>
                <p className={styles.evidenceLink}>
                  → 힐에코의 이해의 바다는 조건 없이 나를 이해하는 시간을 만듭니다
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          Why Heal Echo (서버)
      ============================ */}
      <section id="why-healecho" className={styles.whySection}>
        <div className={styles.container}>
          <div className={styles.whyHead}>
            <p className={styles.eyebrowPink}>Why Heal Echo</p>
            <h2 className={styles.sectionTitle}>
              당신에게 필요한 것은
              <span className={styles.blockOnMobile}>&#39;맞춤 웰니스 솔루션&#39;입니다.</span>
            </h2>
          </div>

          <div className={styles.whyCard}>
            {/* 상단: 맞춤 웰니스 솔루션 */}
            <div className={styles.whyCardGroup}>
              <h3 className={styles.whyCardGroupTitle}>맞춤 웰니스 솔루션</h3>
              <ul className={styles.whyCardList}>
                <li>솔루션별 맞춤 요가 클래스</li>
                <li>현대과학과 아유르베다 기반, 솔루션별 맞춤 생활 습관 설계</li>
                <li>마음을 위한 명상 세션</li>
              </ul>
            </div>

            <div className={styles.whyCardDivider} />

            {/* 하단: 프로그램 진행에 따라 제공 */}
            <div className={styles.whyCardGroup}>
              <h3 className={styles.whyCardGroupTitle}>프로그램 진행에 따라 제공</h3>
              <ul className={styles.whyCardList}>
                <li>피츠버그 대학의 수면 분석 검사 : 연 12회 제공</li>
                <li>체질별 추천 음식 : 연 1회 제공</li>
                <li>인도 아유르베다 도샤 체크를 통한 변화 분석 : 연 4회 제공</li>
                <li>솔루션별 맞춤 자가 체크 : 연 12회 (예 : 자율신경 자가 체크)</li>
                <li>나의 변화를 알 수 있는 항목별 변화 추이 리포트</li>
              </ul>
            </div>

            {/* CTA */}
            <a href="/public/login" className={styles.whyCardCta}>
              지금 시작하기 →
            </a>
            <a href="/public/pricing" className={styles.whyCardPricing}>
              가격 안내 보기
            </a>
          </div>
        </div>
      </section>

      {/* ===========================
          Empathy Section (서버)
      ============================ */}
      <section className={styles.empathySection}>
        <div className={styles.container}>
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

            <a className={styles.empathyCta} href="/public/login">
              지금, 나를 위한 변화 시작하기
            </a>
          </div>
        </div>
      </section>

      {/* Footer (서버) */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
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

          <div className={styles.footerInfo}>
            <p>대표 : 이춘무</p>
            <p>사업자 등록 번호 : 881-04-03516</p>
            <p>통신판매업 신고 번호 :</p>
            <p>
              주소 : 서울특별시 영등포구 국회대로68길 23,
              <span className={styles.blockOnMobile}>3층 308호(여의도동, 정원빌딩)</span>
            </p>
          </div>

          <p className={styles.footerCopyright}>&copy; 2025 Heal Echo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
