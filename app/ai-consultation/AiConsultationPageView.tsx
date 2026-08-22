"use client";

import { useState } from "react";
import { AiConsultationPanel } from "@/app/components/AiConsultationPanel";
import {
  CONSULTATION_PANEL_CLASS,
  type ConsultationViewMode,
} from "@/lib/ai/consultation-ui";

export function AiConsultationPageView({
  companyId,
  popout = false,
}: {
  companyId: string;
  popout?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ConsultationViewMode>("expanded");
  const panelClass = CONSULTATION_PANEL_CLASS[viewMode];

  if (popout) {
    return (
      <AiConsultationPanel
        companyId={companyId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showOpenInNewTab={false}
        showViewModeControls={false}
        autoFocusQuestion
        shellClassName="h-full min-h-0 rounded-lg"
        bodyClassName={`${panelClass.body} max-h-none`}
      />
    );
  }

  return (
    <div className="mt-4">
      <AiConsultationPanel
        companyId={companyId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showOpenInNewTab={false}
        showViewModeControls={false}
        autoFocusQuestion
        shellClassName="w-full min-h-[calc(100vh-12rem)]"
        bodyClassName={`${panelClass.body} min-h-[calc(100vh-22rem)] max-h-none`}
      />
    </div>
  );
}
