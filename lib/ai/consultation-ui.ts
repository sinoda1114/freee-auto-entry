import type { AiConsultationReportPayload } from "@/app/ai-consultation-action";

export type ConsultationChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      targetLabel: string | null;
      report: AiConsultationReportPayload;
      investigationId?: string | null;
      similar?: Array<{
        threadId: string;
        reason: string;
        subject: string;
      }> | null;
    };

export type ConsultationViewMode = "compact" | "expanded" | "fullscreen";

export interface ConsultationPersistedState {
  messages: ConsultationChatMessage[];
  targetHint: string;
  viewMode: ConsultationViewMode;
}

const STORAGE_KEY = "freee-ai-consultation";

export function createConsultationMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withMessageIds(
  messages: ConsultationChatMessage[],
): ConsultationChatMessage[] {
  return messages.map((message, index) => {
    if ("id" in message && typeof message.id === "string") {
      return message;
    }
    return {
      ...message,
      id: `legacy-${index}`,
    };
  });
}

export function loadConsultationState(): ConsultationPersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ConsultationPersistedState;
    return {
      ...parsed,
      messages: withMessageIds(parsed.messages ?? []),
    };
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

export function clearConsultationState(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const VIEW_MODE_LABELS: Record<ConsultationViewMode, string> = {
  compact: "コンパクト",
  expanded: "拡大",
  fullscreen: "全画面",
};

export const CONSULTATION_PANEL_CLASS: Record<
  ConsultationViewMode,
  { shell: string; body: string }
> = {
  compact: {
    shell:
      "w-[min(100vw-2rem,26rem)] max-h-[calc(100dvh-6rem)] sm:h-[min(48dvh,28rem)] sm:w-[min(100vw-3rem,44rem)]",
    body: "min-h-0 flex-1",
  },
  expanded: {
    shell:
      "w-[min(100vw-2rem,40rem)] max-h-[calc(100dvh-6rem)] sm:h-[min(48dvh,28rem)] sm:w-[min(100vw-3rem,44rem)]",
    body: "min-h-0 flex-1",
  },
  fullscreen: {
    shell:
      "inset-3 bottom-[4.75rem] sm:inset-4 sm:bottom-[5.5rem] w-auto max-w-none",
    body: "min-h-0 flex-1",
  },
};
