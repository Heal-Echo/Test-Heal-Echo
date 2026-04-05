"use client";

import { useState } from "react";
import IntroUploader from "@/components/adminStudio/intro-uploader";
import IntroVideoList from "@/components/adminStudio/intro-video-list";
import IntroVideoDetail from "@/components/adminStudio/intro-video-detail";
import type { Video } from "@/types/video";

export default function IntroductionPage() {
  const [selected, setSelected] = useState<Video | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  return (
    <div key={reloadKey} className="p-6 max-w-4xl mx-auto space-y-10">
      <IntroUploader />

      <IntroVideoList onSelect={(v) => setSelected(v)} />

      {selected && (
        <IntroVideoDetail video={selected} onChanged={refresh} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
