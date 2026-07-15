"use client";

import { useState } from "react";
import { AiConsultationPanel } from "./AiConsultationPanel";
import {
  CONSULTATION_PANEL_CLASS,
  type ConsultationViewMode,
} from "@/lib/ai/consultation-ui";

export function AiConsultationWidget({
  companyId,
}: {
  companyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ConsultationViewMode>("compact");
  const panelClass = CONSULTATION_PANEL_CLASS[viewMode];

  return (
    <>
      {open ? (
        <div
          className={`fixed z-50 flex flex-col ${
            viewMode === "fullscreen"
              ? panelClass.shell
              : `bottom-20 right-4 ${panelClass.shell}`
          }`}
        >
          <AiConsultationPanel
            companyId={companyId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClose={() => setOpen(false)}
            bodyClassName={panelClass.body}
          />
        </div>
      ) : null}

      <button
        type="button"
        aria-label="AIに相談する"
        className="fixed bottom-4 right-4 z-50 flex h-12 min-w-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 text-sm font-bold text-white shadow-lg transition hover:opacity-95 sm:text-base"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "閉じる" : "AIに相談"}
      </button>
    </>
  );
}
