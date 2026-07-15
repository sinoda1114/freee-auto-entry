"use client";

import { formatLikelihood } from "@/lib/ai/accounting-consultation";
import type { AiConsultationReportPayload } from "@/app/ai-consultation-action";

export function ConsultationReportView({
  targetLabel,
  report,
}: {
  targetLabel?: string | null;
  report: AiConsultationReportPayload;
}) {
  return (
    <div className="space-y-3 text-sm text-[var(--freee-text)]">
      {targetLabel ? (
        <p className="text-xs font-semibold text-[var(--freee-blue)]">
          調査対象: {targetLabel}
        </p>
      ) : null}
      <p className="leading-relaxed text-[var(--freee-text)]">{report.summary}</p>

      {report.facts.length > 0 ? (
        <section>
          <h3 className="text-xs font-bold text-[var(--freee-text)]">事実</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--freee-text-muted)]">
            {report.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.hypotheses.length > 0 ? (
        <section>
          <h3 className="text-xs font-bold text-[var(--freee-text)]">仮説</h3>
          <div className="mt-1 space-y-2">
            {report.hypotheses.map((hypothesis) => (
              <div
                key={`${hypothesis.title}-${hypothesis.likelihood}`}
                className="rounded-md border border-[var(--freee-border)] bg-[color-mix(in_srgb,var(--freee-blue)_5%,var(--freee-surface))] px-2.5 py-2"
              >
                <p className="text-xs font-semibold">
                  [{formatLikelihood(hypothesis.likelihood)}] {hypothesis.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--freee-text-muted)]">
                  {hypothesis.reasoning}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.checkpoints.length > 0 ? (
        <section>
          <h3 className="text-xs font-bold text-[var(--freee-text)]">
            確認ポイント
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--freee-text-muted)]">
            {report.checkpoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.suggestions.length > 0 ? (
        <section>
          <h3 className="text-xs font-bold text-[var(--freee-text)]">修正案</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--freee-text-muted)]">
            {report.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-[11px] text-[var(--freee-text-muted)]">
        ※ freee のデータは変更しません。調査結果のみです。
      </p>
    </div>
  );
}
