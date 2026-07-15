"use client";

import { Button, Spinner, Textarea } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  aiConsultationAction,
} from "@/app/ai-consultation-action";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import {
  type ConsultationChatMessage,
  type ConsultationViewMode,
  loadConsultationState,
  saveConsultationState,
} from "@/lib/ai/consultation-ui";
import { stashSupportDraft } from "@/lib/support/draft-handoff";

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
    setMessages((prev) => [...prev, { role: "user", content: trimmedQuestion }]);

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("question", trimmedQuestion);
    formData.set("targetHint", targetHint.trim());
    formData.set("pagePath", pathname);

    startTransition(async () => {
      const result = await aiConsultationAction({ status: "idle" }, formData);
      if (result.status === "success") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            targetLabel: result.targetLabel,
            report: result.report,
            investigationId: result.investigationId,
            similar: result.similar,
          },
        ]);
        setQuestion("");
      } else if (result.status === "error") {
        setError(result.message);
      }
    });
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
  };
}

interface AiConsultationPanelProps {
  companyId: string;
  viewMode: ConsultationViewMode;
  onViewModeChange: (mode: ConsultationViewMode) => void;
  onClose?: () => void;
  showOpenInNewTab?: boolean;
  bodyClassName?: string;
  shellClassName?: string;
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
      <div className="flex flex-wrap gap-2">
        <NextLink
          href="/support"
          className="text-[11px] font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline sm:text-xs"
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
            className="text-[11px] font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline sm:text-xs"
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
  bodyClassName = "",
  shellClassName = "",
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
  } = useAiConsultationChat(companyId);

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

  const viewModeLabel =
    viewMode === "compact"
      ? "拡大"
      : viewMode === "expanded"
        ? "全画面"
        : "縮小";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-[var(--freee-border)] bg-[var(--freee-surface)] shadow-2xl ${shellClassName}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--freee-border)] bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-base font-bold">AIに相談する</p>
          <p className="text-xs text-white/85 sm:text-sm">
            経理データの調査モード（読み取り専用）
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10 sm:text-sm"
            onClick={cycleViewMode}
          >
            {viewModeLabel}
          </button>
          {showOpenInNewTab ? (
            <button
              type="button"
              className="hidden rounded-md px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10 sm:inline sm:text-sm"
              onClick={openInNewTab}
            >
              別画面
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              aria-label="閉じる"
              className="rounded-md px-2 py-1 text-lg leading-none text-white/95 hover:bg-white/10"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`space-y-4 overflow-y-auto px-4 py-4 ${bodyClassName}`}
      >
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-[var(--freee-text-muted)]">
            freee の取引・口座振替・明細について、なぜこうなっているかを調べます。
            URL や ID を貼ると調査対象を自動認識します。
          </p>
        ) : null}

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`}>
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
          aria-label="相談内容"
          placeholder="例: なぜこの振替が現金になっている？"
          value={question}
          onValueChange={setQuestion}
          minRows={2}
          maxRows={5}
          size="md"
          variant="bordered"
          classNames={{ input: "text-sm sm:text-base" }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            color="primary"
            size="md"
            className="min-w-[8rem] flex-1 font-semibold"
            isLoading={isPending}
            onPress={handleSubmit}
            isDisabled={!question.trim()}
          >
            調べる
          </Button>
          {showOpenInNewTab ? (
            <Button
              size="md"
              variant="bordered"
              className="font-semibold sm:hidden"
              onPress={openInNewTab}
            >
              別画面
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
