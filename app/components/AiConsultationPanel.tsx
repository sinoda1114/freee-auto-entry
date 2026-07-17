"use client";

import { Button, Spinner, Textarea } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { aiConsultationAction } from "@/app/ai-consultation-action";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import {
  createConsultationMessageId,
  type ConsultationChatMessage,
  type ConsultationViewMode,
  clearConsultationState,
  loadConsultationState,
  saveConsultationState,
  VIEW_MODE_LABELS,
} from "@/lib/ai/consultation-ui";
import { stashSupportDraft } from "@/lib/support/draft-handoff";

const HEADER_ACTION_CLASS =
  "rounded-md px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--freee-blue-dark)] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm";

export function useAiConsultationChat(companyId: string) {
  const pathname = usePathname();
  const [question, setQuestion] = useState("");
  const [targetHint, setTargetHint] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return loadConsultationState()?.targetHint ?? "";
  });
  const [messages, setMessages] = useState<ConsultationChatMessage[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return loadConsultationState()?.messages ?? [];
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    saveConsultationState({
      messages,
      targetHint,
      viewMode: "compact",
    });
  }, [messages, targetHint]);

  function handleSubmit() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isPending) {
      return;
    }

    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: createConsultationMessageId(),
        role: "user",
        content: trimmedQuestion,
      },
    ]);

    const historyPayload = messages.map((message) =>
      message.role === "user"
        ? { role: "user" as const, content: message.content }
        : {
            role: "assistant" as const,
            content: message.report.summary,
          },
    );

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("question", trimmedQuestion);
    formData.set("targetHint", targetHint.trim());
    formData.set("pagePath", pathname);
    formData.set("history", JSON.stringify(historyPayload));

    startTransition(async () => {
      const result = await aiConsultationAction({ status: "idle" }, formData);
      if (result.status === "success") {
        setMessages((prev) => [
          ...prev,
          {
            id: createConsultationMessageId(),
            role: "assistant",
            targetLabel: result.targetLabel,
            report: result.report,
            investigationId: result.investigationId,
            similar: result.similar ?? [],
          },
        ]);
        setQuestion("");
      } else if (result.status === "error") {
        setError(result.message);
      }
    });
  }

  function clearChat() {
    if (isPending) {
      return;
    }
    setMessages([]);
    setQuestion("");
    setTargetHint("");
    setError(null);
    clearConsultationState();
  }

  return {
    question,
    setQuestion,
    targetHint,
    setTargetHint,
    messages,
    error,
    isPending,
    handleSubmit,
    clearChat,
  };
}

interface AiConsultationPanelProps {
  companyId: string;
  viewMode: ConsultationViewMode;
  onViewModeChange: (mode: ConsultationViewMode) => void;
  onClose?: () => void;
  showOpenInNewTab?: boolean;
  showViewModeControls?: boolean;
  autoFocusQuestion?: boolean;
  bodyClassName?: string;
  shellClassName?: string;
  panelId?: string;
}

function AssistantMessage({
  message,
}: {
  message: Extract<ConsultationChatMessage, { role: "assistant" }>;
}) {
  const similar = message.similar ?? [];
  return (
    <div className="space-y-2">
      <ConsultationReportView
        targetLabel={message.targetLabel}
        report={message.report}
      />
      {similar.length > 0 ? (
        <RelatedSupportThreads
          title="似ている過去の問い合わせ"
          items={similar.map((item) => ({
            id: item.threadId,
            subject: item.subject,
            status: "resolved",
            category: "other",
            questionSummary: item.reason,
            createdAt: "",
            reason: item.reason,
          }))}
        />
      ) : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <NextLink
          href="/support"
          className="text-sm font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
        >
          問い合わせ履歴へ
        </NextLink>
        {message.investigationId ? (
          <NextLink
            href={`/support/new?investigationId=${encodeURIComponent(message.investigationId)}`}
            onClick={() =>
              stashSupportDraft(
                [
                  `件名: ${message.targetLabel ?? "AI調査からの下書き"}`,
                  "",
                  `調査要約: ${message.report.summary}`,
                ].join("\n"),
              )
            }
            className="text-sm font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
          >
            この内容でfreeeへの問い合わせ文を作る
          </NextLink>
        ) : null}
      </div>
    </div>
  );
}

export function AiConsultationPanel({
  companyId,
  viewMode,
  onViewModeChange,
  onClose,
  showOpenInNewTab = true,
  showViewModeControls = true,
  autoFocusQuestion = false,
  bodyClassName = "",
  shellClassName = "",
  panelId,
}: AiConsultationPanelProps) {
  const {
    question,
    setQuestion,
    targetHint,
    setTargetHint,
    messages,
    error,
    isPending,
    handleSubmit,
    clearChat,
  } = useAiConsultationChat(companyId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const generatedId = useId();
  const resolvedPanelId = panelId ?? `ai-consultation-panel-${generatedId}`;

  const canClear =
    !isPending &&
    (messages.length > 0 ||
      question.trim().length > 0 ||
      targetHint.trim().length > 0 ||
      Boolean(error));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isPending, error]);

  useEffect(() => {
    if (!autoFocusQuestion) {
      return;
    }
    questionRef.current?.focus();
  }, [autoFocusQuestion]);

  useEffect(() => {
    if (!onClose) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function openInNewTab() {
    saveConsultationState({ messages, targetHint, viewMode: "expanded" });
    window.open("/ai-consultation", "_blank", "noopener,noreferrer");
  }

  function cycleViewMode() {
    if (viewMode === "compact") {
      onViewModeChange("expanded");
      return;
    }
    if (viewMode === "expanded") {
      onViewModeChange("fullscreen");
      return;
    }
    onViewModeChange("compact");
  }

  const nextViewModeLabel =
    viewMode === "compact"
      ? "拡大"
      : viewMode === "expanded"
        ? "全画面"
        : "コンパクト";

  return (
    <div
      id={resolvedPanelId}
      role="dialog"
      aria-label="AIに相談する"
      aria-modal={onClose ? true : undefined}
      className={`flex max-h-full flex-col overflow-hidden rounded-xl border border-[var(--freee-border)] bg-[var(--freee-surface)] shadow-2xl ${shellClassName}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--freee-border)] bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-base font-bold">AIに相談する</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={HEADER_ACTION_CLASS}
            onClick={clearChat}
            disabled={!canClear}
            aria-label="会話をクリア"
          >
            クリア
          </button>
          {showViewModeControls ? (
            <button
              type="button"
              className={HEADER_ACTION_CLASS}
              aria-label={`表示サイズを変更（現在: ${VIEW_MODE_LABELS[viewMode]}）`}
              title={`現在: ${VIEW_MODE_LABELS[viewMode]}`}
              onClick={cycleViewMode}
            >
              {nextViewModeLabel}
            </button>
          ) : null}
          {showOpenInNewTab ? (
            <button
              type="button"
              className={`hidden sm:inline ${HEADER_ACTION_CLASS}`}
              onClick={openInNewTab}
            >
              別画面
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              aria-label="閉じる"
              className={`text-lg leading-none ${HEADER_ACTION_CLASS}`}
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className={`space-y-4 overflow-y-auto px-4 py-4 ${bodyClassName}`}>
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-[var(--freee-text-muted)] sm:text-base sm:leading-7">
            freee の取引・口座振替・明細に加え、損益計算書や貸借対照表も参照して調べます。
            URL や ID を貼ると調査対象を自動認識します。freee
            のデータは変更しません。
          </p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <div className="ml-4 rounded-lg bg-[color-mix(in_srgb,var(--freee-blue)_10%,var(--freee-surface))] px-3 py-2.5 text-sm leading-relaxed sm:ml-8 sm:text-base">
                {message.content}
              </div>
            ) : (
              <AssistantMessage message={message} />
            )}
          </div>
        ))}

        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--freee-text-muted)]">
            <Spinner size="sm" color="primary" />
            調査中…
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="space-y-2.5 border-t border-[var(--freee-border)] px-4 py-3">
        <Textarea
          aria-label="調査対象のヒント"
          placeholder="freee URL や ID（任意）"
          value={targetHint}
          onValueChange={setTargetHint}
          minRows={1}
          maxRows={2}
          size="md"
          variant="bordered"
          classNames={{ input: "text-sm sm:text-base" }}
        />
        <Textarea
          ref={questionRef as RefObject<HTMLTextAreaElement>}
          aria-label="相談内容"
          placeholder="例: 25年度の損益計算書のポイントは？ / なぜこの振替が現金になっている？"
          value={question}
          onValueChange={setQuestion}
          minRows={2}
          maxRows={5}
          size="md"
          variant="bordered"
          classNames={{ input: "text-sm sm:text-base" }}
          onKeyDown={(event) => {
            // 日本語IMEの変換確定 Enter では送信しない
            if (event.nativeEvent.isComposing || event.keyCode === 229) {
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        {showOpenInNewTab ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="md"
              variant="bordered"
              className="font-semibold sm:hidden"
              onPress={openInNewTab}
            >
              別画面
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
