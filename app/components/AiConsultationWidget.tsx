"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ConsultationViewMode>("compact");
  const panelId = useId();
  const panelClass = CONSULTATION_PANEL_CLASS[viewMode];

  if (pathname.startsWith("/ai-consultation")) {
    return null;
  }

  return (
    <>
      {open ? (
        <div
          className={`fixed z-50 flex flex-col transition-all duration-200 ease-out ${
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
            autoFocusQuestion
            panelId={panelId}
            shellClassName="h-full"
            bodyClassName={panelClass.body}
          />
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "AI相談を閉じる" : "AIに相談する"}
        aria-expanded={open}
        aria-controls={panelId}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-[7.5rem] items-center justify-center rounded-full bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] text-sm font-bold text-white shadow-lg transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--freee-blue)] focus-visible:ring-offset-2 sm:h-14 sm:w-40 sm:text-lg"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "閉じる" : "AIに相談"}
      </button>
    </>
  );
}
