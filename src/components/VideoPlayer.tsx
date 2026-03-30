// src/components/VideoPlayer.tsx
// 확인 방법:
// 1) <VideoPlayer s3Key="videos/sample.mp4" /> 처럼 렌더링.
// 2) CloudFront에 해당 키가 존재하면 재생되어야 함.

import React from "react";
import { CLOUDFRONT_URL } from "@/config/constants";

export default function VideoPlayer({ s3Key, poster }: { s3Key: string; poster?: string }) {
  const src = `${CLOUDFRONT_URL}${s3Key}`;
  return (
    <video src={src} controls className="w-full max-w-3xl" poster={poster} />
  );
}

