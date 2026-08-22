"use client";

import { Button, Textarea } from "@heroui/react";
import { ProcessingStatus } from "@/app/components/ProcessingStatus";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type RefObject,
  type WheelEvent,
} from "react";
import { aiConsultationAction } from "@/app/ai-consultation-action";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { ConsultationFontSizeControl } from "@/app/components/ConsultationFontSizeControl";
import {
  ClearChatIcon,
  CloseIcon,
  CompressIcon,
  DockBackIcon,
  ExpandIcon,
  PopoutIcon,
} from "@/app/components/ConsultationHeaderIcons";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import {
  clampConsultationFontSize,
  CONSULTATION_FONT_SIZE_DEFAULT,
  createConsultationMessageId,
  type ConsultationChatMessage,
  type ConsultationViewMode,
  clearConsultationState,
  dockAiConsultationPopout,
  loadConsultationFontSize,
  loadConsultationState,
  openAiConsultationPopout,
  saveConsultationFontSize,
  saveConsultationState,
  VIEW_MODE_LABELS,
  type ConsultationPanelSize,
} from "@/lib/ai/consultation-ui";
import { stashSupportDraft } from "@/lib/support/draft-handoff";

const HEADER_ACTION_CLASS =
  "inline-flex size-8 items-center justify-center rounded-md text-white/95 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--freee-blue-dark)] disabled:cursor-not-allowed disabled:opacity-40";
const CHAT_INPUT_CLASS = "text-[1em] leading-relaxed";

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
  /** ポップアウト窓から本体FABへ戻すボタン */
  showDockBack?: boolean;
  showViewModeControls?: boolean;
  autoFocusQuestion?: boolean;
  bodyClassName?: string;
  shellClassName?: string;
  panelId?: string;
  /** ポップアウト窓の初期サイズ（未指定時は既定値） */
  popoutSize?: ConsultationPanelSize;
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
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[1em]">
        <NextLink
          href="/support"
          className="font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
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
            className="font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
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
  showDockBack = false,
  showViewModeControls = true,
  autoFocusQuestion = false,
  bodyClassName = "",
  shellClassName = "",
  panelId,
  popoutSize,
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
  const keyboardHintId = `${generatedId}-keyboard-hint`;
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === "undefined") {
      return CONSULTATION_FONT_SIZE_DEFAULT;
    }
    return loadConsultationFontSize();
  });
  const canSubmit = question.trim().length > 0 && !isPending;

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
    saveConsultationFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (!autoFocusQuestion) {
      return;
    }
    questionRef.current?.focus();
  }, [autoFocusQuestion]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (viewMode === "fullscreen") {
        onViewModeChange("compact");
        return;
      }
      onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onViewModeChange, viewMode]);

  function openPopout() {
    saveConsultationState({ messages, targetHint, viewMode: "compact" });
    openAiConsultationPopout(popoutSize);
    onClose?.();
  }

  function dockBack() {
    saveConsultationState({ messages, targetHint, viewMode: "compact" });
    dockAiConsultationPopout();
  }

  function toggleFullscreen() {
    onViewModeChange(viewMode === "fullscreen" ? "compact" : "fullscreen");
  }

  function updateFontSize(next: number) {
    setFontSize(clampConsultationFontSize(next));
  }

  function handlePanelWheel(event: WheelEvent<HTMLDivElement>) {
    // YouTube volume と同様: Ctrl/Cmd + ホイールで文字サイズ
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    if (Math.abs(event.deltaY) < 1) {
      return;
    }
    event.preventDefault();
    updateFontSize(fontSize + (event.deltaY < 0 ? 1 : -1));
  }

  const isFullscreen = viewMode === "fullscreen";
  const chatFontStyle = { fontSize: `${fontSize}px` };

  return (
    <div
      id={resolvedPanelId}
      role="dialog"
      aria-label="AIに相談する"
      aria-modal={onClose ? true : undefined}
      onWheel={handlePanelWheel}
      className={`flex h-full max-h-full flex-col overflow-hidden rounded-xl border border-[var(--freee-border)] bg-[var(--freee-surface)] shadow-2xl ${shellClassName}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--freee-border)] bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 py-2 text-white">
        <div className="min-w-0">
          <p className="text-sm font-bold sm:text-base">AIに相談する</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ConsultationFontSizeControl
            fontSize={fontSize}
            onFontSizeChange={updateFontSize}
            actionClassName={HEADER_ACTION_CLASS}
          />
          <button
            type="button"
            className={HEADER_ACTION_CLASS}
            onClick={clearChat}
            disabled={!canClear}
            aria-label="会話をクリア"
            title="クリア"
          >
            <ClearChatIcon />
          </button>
          {showViewModeControls ? (
            <button
              type="button"
              className={HEADER_ACTION_CLASS}
              aria-label={
                isFullscreen
                  ? "コンパクト表示に戻す"
                  : `全画面にする（現在: ${VIEW_MODE_LABELS[viewMode]}）`
              }
              title={isFullscreen ? "コンパクトに戻す" : "全画面"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
            </button>
          ) : null}
          {showOpenInNewTab ? (
            <button
              type="button"
              className={HEADER_ACTION_CLASS}
              aria-label="ポップアウトして別ウィンドウで開く"
              title="ポップアウト"
              onClick={openPopout}
            >
              <PopoutIcon />
            </button>
          ) : null}
          {showDockBack ? (
            <button
              type="button"
              className={HEADER_ACTION_CLASS}
              aria-label="本体のFABに戻す"
              title="FABに戻す"
              onClick={dockBack}
            >
              <DockBackIcon />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              aria-label="閉じる"
              title="閉じる"
              className={HEADER_ACTION_CLASS}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={chatFontStyle}
        className={
          messages.length === 0 && !isPending && !error
            ? "max-h-0 min-h-0 overflow-hidden p-0"
            : `space-y-4 overflow-y-auto px-4 py-4 ${bodyClassName}`
        }
      >
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <div className="ml-4 rounded-lg bg-[color-mix(in_srgb,var(--freee-blue)_10%,var(--freee-surface))] px-3 py-2.5 text-[1em] leading-relaxed sm:ml-8">
                {message.content}
              </div>
            ) : (
              <AssistantMessage message={message} />
            )}
          </div>
        ))}

        {isPending ? (
          <ProcessingStatus label="調査中…" />
        ) : null}

        {error ? (
          <p role="alert" className="text-[1em] text-danger">
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div
        style={chatFontStyle}
        className={`flex min-h-0 flex-col space-y-2.5 border-t border-[var(--freee-border)] px-4 py-3 ${
          messages.length === 0 && !isPending && !error ? "flex-1" : "shrink-0"
        }`}
      >
        <Textarea
          aria-label="調査対象のヒント"
          placeholder="freee URL や ID（任意）"
          value={targetHint}
          onValueChange={setTargetHint}
          minRows={1}
          maxRows={2}
          size="md"
          variant="bordered"
          classNames={{ input: CHAT_INPUT_CLASS }}
        />
        <Textarea
          ref={questionRef as RefObject<HTMLTextAreaElement>}
          aria-label="相談内容"
          aria-describedby={keyboardHintId}
          placeholder="例: 25年度の損益計算書のポイントは？ / なぜこの振替が現金になっている？"
          value={question}
          onValueChange={setQuestion}
          minRows={messages.length === 0 ? 5 : 3}
          maxRows={messages.length === 0 ? 12 : 8}
          size="md"
          variant="bordered"
          classNames={{
            base:
              messages.length === 0 && !isPending && !error
                ? "flex min-h-0 flex-1 flex-col"
                : undefined,
            inputWrapper:
              messages.length === 0 && !isPending && !error
                ? "flex-1 items-start"
                : undefined,
            input: CHAT_INPUT_CLASS,
          }}
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            id={keyboardHintId}
            className="hidden text-xs text-[var(--freee-text-muted)] sm:inline"
          >
            Enter で送信 / Shift+Enter で改行 / Ctrl+ホイールで文字サイズ
          </span>
          <Button
            size="md"
            color="primary"
            className="ml-auto font-semibold"
            onPress={handleSubmit}
            isDisabled={!canSubmit}
            isLoading={isPending}
          >
            送信
          </Button>
        </div>
      </div>
    </div>
  );
}
