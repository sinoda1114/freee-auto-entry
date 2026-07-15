"use client";

import { Button, Spinner, Textarea } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  aiConsultationAction,
  type AiConsultationReportPayload,
} from "@/app/ai-consultation-action";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import { stashSupportDraft } from "@/lib/support/draft-handoff";

type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      targetLabel: string | null;
      report: AiConsultationReportPayload;
      investigationId: string | null;
      similar: Array<{ threadId: string; reason: string; subject: string }>;
    };

export function AiConsultationWidget({
  companyId,
}: {
  companyId: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [targetHint, setTargetHint] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-4 z-50 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border border-[var(--freee-border)] bg-[var(--freee-surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--freee-border)] bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">AIに相談する</p>
              <p className="text-[11px] text-white/80">
                経理データの調査モード（読み取り専用）
              </p>
            </div>
            <button
              type="button"
              aria-label="閉じる"
              className="rounded-md px-2 py-1 text-sm text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-xs leading-relaxed text-[var(--freee-text-muted)]">
                freee の取引・口座振替・明細について、なぜこうなっているかを調べます。
                URL や ID を貼ると調査対象を自動認識します。
              </p>
            ) : null}

            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`}>
                {message.role === "user" ? (
                  <div className="ml-6 rounded-lg bg-[color-mix(in_srgb,var(--freee-blue)_10%,var(--freee-surface))] px-3 py-2 text-xs text-[var(--freee-text)]">
                    {message.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ConsultationReportView
                      targetLabel={message.targetLabel}
                      report={message.report}
                    />
                    {message.similar.length > 0 ? (
                      <RelatedSupportThreads
                        title="似ている過去の問い合わせ"
                        items={message.similar.map((item) => ({
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
                        className="text-[11px] font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
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
                          className="text-[11px] font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
                        >
                          この内容でfreeeへの問い合わせ文を作る
                        </NextLink>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isPending ? (
              <div className="flex items-center gap-2 text-xs text-[var(--freee-text-muted)]">
                <Spinner size="sm" color="primary" />
                調査中…
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-[var(--freee-border)] px-4 py-3">
            <Textarea
              aria-label="調査対象のヒント"
              placeholder="freee URL や ID（任意）"
              value={targetHint}
              onValueChange={setTargetHint}
              minRows={1}
              maxRows={2}
              size="sm"
              variant="bordered"
            />
            <Textarea
              aria-label="相談内容"
              placeholder="例: なぜこの振替が現金になっている？"
              value={question}
              onValueChange={setQuestion}
              minRows={2}
              maxRows={4}
              size="sm"
              variant="bordered"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              color="primary"
              size="sm"
              className="w-full font-semibold"
              isLoading={isPending}
              onPress={handleSubmit}
              isDisabled={!question.trim()}
            >
              調べる
            </Button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="AIに相談する"
        className="fixed bottom-4 right-4 z-50 flex h-12 min-w-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] px-4 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "閉じる" : "AIに相談"}
      </button>
    </>
  );
}
