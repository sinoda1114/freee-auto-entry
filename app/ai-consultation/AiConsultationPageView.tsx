"use client";

import { useState } from "react";
import { AiConsultationPanel } from "@/app/components/AiConsultationPanel";
import {
  CONSULTATION_PANEL_CLASS,
  type ConsultationViewMode,
} from "@/lib/ai/consultation-ui";

export function AiConsultationPageView({
  companyId,
}: {
  companyId: string;
}) {
  const [viewMode, setViewMode] = useState<ConsultationViewMode>("expanded");
  const panelClass = CONSULTATION_PANEL_CLASS[viewMode];

  return (
    <div className="mt-4">
      <AiConsultationPanel
        companyId={companyId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showOpenInNewTab={false}
        shellClassName="w-full"
        bodyClassName={`${panelClass.body} min-h-[calc(100vh-22rem)]`}
      />
    </div>
  );
}
