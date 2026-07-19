"use client";

import type { ReactNode } from "react";
import { Chip } from "@heroui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatLikelihood } from "@/lib/ai/accounting-consultation";
import type { AiConsultationReportPayload } from "@/app/ai-consultation-action";

const LIKELIHOOD_CHIP_COLOR = {
  high: "success",
  medium: "warning",
  low: "default",
} as const;

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 text-base font-bold text-[var(--freee-text)] first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 text-base font-bold text-[var(--freee-text)] first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 text-sm font-bold tracking-wide text-[var(--freee-text)] first:mt-0 sm:text-base">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 text-base leading-7 text-[var(--freee-text)] first:mt-0 last:mb-0 sm:text-[1.05rem]">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5 text-base leading-7">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-base leading-7">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-[var(--freee-text)]">{children}</strong>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-[var(--freee-border)]">
      <table className="w-full min-w-[16rem] border-collapse text-sm sm:text-base">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-[color-mix(in_srgb,var(--freee-blue)_8%,var(--freee-surface))]">
      {children}
    </thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-[var(--freee-border)] px-3 py-2 text-left font-semibold text-[var(--freee-text)]">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-[var(--freee-border)] px-3 py-2 text-[var(--freee-text)] last:text-right">
      {children}
    </td>
  ),
  hr: () => <hr className="my-3 border-[var(--freee-border)]" />,
};

export function ConsultationReportView({
  targetLabel,
  report,
}: {
  targetLabel?: string | null;
  report: AiConsultationReportPayload;
}) {
  const mode = report.mode ?? "investigate";
  const isPresent = mode === "present";
  const factsTitle = isPresent ? "主な数字" : "事実";

  return (
    <div className="space-y-4 text-base leading-relaxed text-[var(--freee-text)]">
      {targetLabel && !isPresent ? (
        <p className="text-sm font-semibold text-[var(--freee-blue)]">
          調査対象: {targetLabel}
        </p>
      ) : null}
      {targetLabel && isPresent ? (
        <p className="text-sm font-semibold text-[var(--freee-blue)]">
          {targetLabel}
        </p>
      ) : null}
      <div className="text-base leading-7 text-[var(--freee-text)] sm:text-[1.05rem]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {report.summary}
        </ReactMarkdown>
      </div>

      {report.facts.length > 0 ? (
        <section className="rounded-md border border-[var(--freee-border)] border-l-[3px] border-l-[var(--freee-blue)] px-3 py-2.5">
          <h3 className="text-sm font-bold tracking-wide text-[var(--freee-blue)]">
            {factsTitle}
          </h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[var(--freee-text-muted)] sm:text-base">
            {report.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isPresent && report.hypotheses.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-bold tracking-wide text-[var(--freee-text)]">
            仮説
          </h3>
          <div className="space-y-2.5">
            {report.hypotheses.map((hypothesis) => (
              <div
                key={`${hypothesis.title}-${hypothesis.likelihood}`}
                className="rounded-lg border border-[var(--freee-border)] bg-[color-mix(in_srgb,var(--freee-blue)_8%,var(--freee-surface))] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={LIKELIHOOD_CHIP_COLOR[hypothesis.likelihood]}
                    classNames={{ content: "text-[11px] font-semibold" }}
                  >
                    確率 {formatLikelihood(hypothesis.likelihood)}
                  </Chip>
                  <p className="text-sm font-semibold text-[var(--freee-text)]">
                    {hypothesis.title}
                  </p>
                </div>
                <p className="mt-1.5 text-sm leading-7 text-[var(--freee-text-muted)] sm:text-base">
                  {hypothesis.reasoning}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isPresent && report.checkpoints.length > 0 ? (
        <section className="rounded-md border border-[var(--freee-border)] bg-[var(--freee-bg)] px-3 py-2.5">
          <h3 className="text-sm font-bold tracking-wide text-[var(--freee-text)]">
            確認ポイント
          </h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[var(--freee-text-muted)] sm:text-base">
            {report.checkpoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isPresent && report.suggestions.length > 0 ? (
        <section className="rounded-md border border-[var(--freee-border)] border-l-[3px] border-l-[var(--freee-billing)] bg-[color-mix(in_srgb,var(--freee-billing)_8%,var(--freee-surface))] px-3 py-2.5">
          <h3 className="text-sm font-bold tracking-wide text-[var(--freee-billing)]">
            修正案
          </h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-7 text-[var(--freee-text-muted)] sm:text-base">
            {report.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
