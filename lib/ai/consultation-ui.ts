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
const FONT_SIZE_STORAGE_KEY = "freee-ai-consultation-font-size";

export const CONSULTATION_FONT_SIZE_MIN = 14;
export const CONSULTATION_FONT_SIZE_MAX = 20;
export const CONSULTATION_FONT_SIZE_DEFAULT = 16;

export function clampConsultationFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return CONSULTATION_FONT_SIZE_DEFAULT;
  }
  return Math.min(
    CONSULTATION_FONT_SIZE_MAX,
    Math.max(CONSULTATION_FONT_SIZE_MIN, Math.round(value)),
  );
}

export function loadConsultationFontSize(): number {
  if (typeof window === "undefined") {
    return CONSULTATION_FONT_SIZE_DEFAULT;
  }
  try {
    const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw == null) {
      return CONSULTATION_FONT_SIZE_DEFAULT;
    }
    return clampConsultationFontSize(Number(raw));
  } catch {
    return CONSULTATION_FONT_SIZE_DEFAULT;
  }
}

export function saveConsultationFontSize(fontSize: number): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      FONT_SIZE_STORAGE_KEY,
      String(clampConsultationFontSize(fontSize)),
    );
  } catch {
    // ignore quota errors
  }
}

const PANEL_SIZE_STORAGE_KEY = "freee-ai-consultation-panel-size";

export const CONSULTATION_PANEL_WIDTH_MIN = 280;
export const CONSULTATION_PANEL_HEIGHT_MIN = 240;
export const CONSULTATION_PANEL_WIDTH_DEFAULT = 480;
export const CONSULTATION_PANEL_HEIGHT_DEFAULT = 420;

export type ConsultationPanelSize = {
  width: number;
  height: number;
};

export function clampConsultationPanelSize(
  size: ConsultationPanelSize,
  viewport?: { width: number; height: number },
): ConsultationPanelSize {
  const vw =
    viewport?.width ??
    (typeof window !== "undefined" ? window.innerWidth : 1280);
  const vh =
    viewport?.height ??
    (typeof window !== "undefined" ? window.innerHeight : 800);
  const maxWidth = Math.max(CONSULTATION_PANEL_WIDTH_MIN, vw - 32);
  // FAB + margins (~5.5rem bottom + 1rem top)
  const maxHeight = Math.max(CONSULTATION_PANEL_HEIGHT_MIN, vh - 104);

  const width = Number.isFinite(size.width)
    ? Math.min(maxWidth, Math.max(CONSULTATION_PANEL_WIDTH_MIN, Math.round(size.width)))
    : CONSULTATION_PANEL_WIDTH_DEFAULT;
  const height = Number.isFinite(size.height)
    ? Math.min(
        maxHeight,
        Math.max(CONSULTATION_PANEL_HEIGHT_MIN, Math.round(size.height)),
      )
    : CONSULTATION_PANEL_HEIGHT_DEFAULT;

  return { width, height };
}

export function loadConsultationPanelSize(): ConsultationPanelSize {
  const fallback = {
    width: CONSULTATION_PANEL_WIDTH_DEFAULT,
    height: CONSULTATION_PANEL_HEIGHT_DEFAULT,
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) {
      return clampConsultationPanelSize(fallback);
    }
    const parsed = JSON.parse(raw) as Partial<ConsultationPanelSize>;
    return clampConsultationPanelSize({
      width: Number(parsed.width),
      height: Number(parsed.height),
    });
  } catch {
    return clampConsultationPanelSize(fallback);
  }
}

export function saveConsultationPanelSize(size: ConsultationPanelSize): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(
      PANEL_SIZE_STORAGE_KEY,
      JSON.stringify(clampConsultationPanelSize(size)),
    );
  } catch {
    // ignore quota errors
  }
}

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
