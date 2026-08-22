"use client";

import { useEffect } from "react";

/** ポップアウト窓ではヘッダー／FAB を隠し、チャットを全面表示する */
export function AiConsultationPopoutChrome() {
  useEffect(() => {
    document.documentElement.classList.add("ai-consultation-popout");
    return () => {
      document.documentElement.classList.remove("ai-consultation-popout");
    };
  }, []);

  return null;
}
