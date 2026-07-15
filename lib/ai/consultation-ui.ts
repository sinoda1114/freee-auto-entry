import type { AiConsultationReportPayload } from "@/app/ai-consultation-action";

export type ConsultationChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      targetLabel: string | null;
      report: AiConsultationReportPayload;
      investigationId?: string | null;
      similar?: Array<{ threadId: string; reason: string; subject: string }>;
    };

export type ConsultationViewMode = "compact" | "expanded" | "fullscreen";

export interface ConsultationPersistedState {
  messages: ConsultationChatMessage[];
  targetHint: string;
  viewMode: ConsultationViewMode;
}

const STORAGE_KEY = "freee-ai-consultation";

export function loadConsultationState(): ConsultationPersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ConsultationPersistedState;
  } catch {
    return null;
  }
}

export function saveConsultationState(state: ConsultationPersistedState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export const CONSULTATION_PANEL_CLASS: Record<
  ConsultationViewMode,
  { shell: string; body: string }
> = {
  compact: {
    shell: "w-[min(100vw-2rem,26rem)]",
    body: "max-h-[min(55vh,26rem)]",
  },
  expanded: {
    shell: "w-[min(100vw-2rem,40rem)]",
    body: "max-h-[min(72vh,36rem)]",
  },
  fullscreen: {
    shell:
      "left-4 right-4 top-16 bottom-20 w-auto max-w-4xl mx-auto sm:left-8 sm:right-8",
    body: "max-h-[calc(100vh-16rem)]",
  },
};
