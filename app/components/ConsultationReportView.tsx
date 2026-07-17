"use client";

import { Chip } from "@heroui/react";
import { formatLikelihood } from "@/lib/ai/accounting-consultation";
import type { AiConsultationReportPayload } from "@/app/ai-consultation-action";

const LIKELIHOOD_CHIP_COLOR = {
  high: "success",
  medium: "warning",
  low: "default",
} as const;

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
      <p className="text-base leading-7 text-[var(--freee-text)] sm:text-[1.05rem]">
        {report.summary}
      </p>

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
                    尤度 {formatLikelihood(hypothesis.likelihood)}
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

      <p className="text-xs leading-5 text-[var(--freee-text-muted)]">
        {isPresent
          ? "※ freee API から取得した数値の要約です。データは変更しません。"
          : "※ freee のデータは変更しません。調査結果のみです。"}
      </p>
    </div>
  );
}
