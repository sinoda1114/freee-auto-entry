"use client";

import { Button, Spinner, Textarea } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  aiConsultationAction,
  type AiConsultationReportPayload,
} from "@/app/ai-consultation-action";
import { formatLikelihood } from "@/lib/ai/accounting-consultation";
import {
  type ConsultationChatMessage,
  type ConsultationViewMode,
  loadConsultationState,
  saveConsultationState,
} from "@/lib/ai/consultation-ui";

function ConsultationReportView({
  targetLabel,
  report,
}: {
  targetLabel: string | null;
  report: AiConsultationReportPayload;
}) {
  return (
    <div className="space-y-4 text-base text-[var(--freee-text)]">
      {targetLabel ? (
        <p className="text-sm font-semibold text-[var(--freee-blue)]">
          調査対象: {targetLabel}
        </p>
      ) : null}
      <p className="text-base leading-relaxed">{report.summary}</p>

      {report.facts.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">事実</h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--freee-text-muted)]">
            {report.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.hypotheses.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">仮説</h3>
          <div className="mt-1.5 space-y-2.5">
            {report.hypotheses.map((hypothesis) => (
              <div
                key={`${hypothesis.title}-${hypothesis.likelihood}`}
                className="rounded-md border border-[var(--freee-border)] bg-[color-mix(in_srgb,var(--freee-blue)_5%,var(--freee-surface))] px-3 py-2.5"
              >
                <p className="text-sm font-semibold">
                  [{formatLikelihood(hypothesis.likelihood)}] {hypothesis.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--freee-text-muted)]">
                  {hypothesis.reasoning}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.checkpoints.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">確認ポイント</h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--freee-text-muted)]">
            {report.checkpoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.suggestions.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">修正案</h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--freee-text-muted)]">
            {report.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-[var(--freee-text-muted)]">
        ※ freee のデータは変更しません。調査結果のみです。
      </p>
    </div>
  );
}

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
              <ConsultationReportView
                targetLabel={message.targetLabel}
                report={message.report}
              />
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
