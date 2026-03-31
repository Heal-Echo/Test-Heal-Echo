/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: false,

  // 모든 API Route / Server Component에서 Node.js runtime 사용
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost", "127.0.0.1", "192.168.45.77", "appleid.apple.com", "findable-felisa-rugose.ngrok-free.dev"],
    },
  },

  // 개발환경에서는 secure cookie 불가 → 자동 처리
  env: {
    ADMIN_COOKIE_SECURE: isProd ? "true" : "false",
    ADMIN_COOKIE_SAMESITE: isProd ? "strict" : "lax",
  },

  // CORS / Header 안정화
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization,Content-Type" },
        ],
      },
    ];
  },

  // 이미지 최적화 설정
  images: {
    // 모바일/태블릿 디바이스 최적화 크기
    deviceSizes: [360, 480, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320],
    // WebP 우선, AVIF 지원 브라우저에서 추가 최적화
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
    ],
  },
};

module.exports = nextConfig;
