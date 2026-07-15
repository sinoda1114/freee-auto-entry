"use client";

import { Button, Textarea } from "@heroui/react";
import NextLink from "next/link";
import { useActionState, useState } from "react";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import { stashSupportDraft } from "@/lib/support/draft-handoff";
import {
  investigateSupportAction,
  type InvestigateSupportState,
} from "./actions";

const initialState: InvestigateSupportState = { status: "idle" };

export function SupportInvestigateView({
  companyId,
  initialQuestion = "",
  initialTargetHint = "",
  pagePath = "/support/investigate",
}: {
  companyId: string;
  initialQuestion?: string;
  initialTargetHint?: string;
  pagePath?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    investigateSupportAction,
    initialState,
  );
  const [question, setQuestion] = useState(initialQuestion);
  const [targetHint, setTargetHint] = useState(initialTargetHint);

  return (
    <PageShell width="lg">
      <PageHeader
        title="問い合わせ前調査"
        description="同じことを聞いていないか確認し、freee上の事実から仮説を立てます"
        actions={
          <Button as={NextLink} href="/support" size="sm" variant="light">
            履歴一覧へ
          </Button>
        }
      />

      <form action={formAction} className="panel mt-4 space-y-3 px-4 py-4">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="pagePath" value={pagePath} />
        <Textarea
          name="targetHint"
          label="調査対象（URL / ID）"
          value={targetHint}
          onValueChange={setTargetHint}
          minRows={1}
          variant="bordered"
          placeholder="例: wallet_txn_id=12345"
        />
        <Textarea
          name="question"
          label="調査したいこと"
          value={question}
          onValueChange={setQuestion}
          minRows={3}
          variant="bordered"
          isRequired
          placeholder="例: なぜこのカード明細が現金振替になっている？"
        />
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        <Button
          type="submit"
          color="primary"
          isLoading={isPending}
          isDisabled={!question.trim()}
        >
          調査する
        </Button>
      </form>

      {state.status === "success" ? (
        <div className="panel mt-4 space-y-4 px-4 py-4">
          <ConsultationReportView
            targetLabel={state.targetLabel}
            report={state.report}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              as={NextLink}
              href={`/support/new?investigationId=${encodeURIComponent(state.investigationId)}`}
              onClick={() =>
                stashSupportDraft(
                  [
                    `件名: ${state.targetLabel ?? "freee問い合わせ下書き"}`,
                    "",
                    `質問: ${question}`,
                    "",
                    `調査要約: ${state.report.summary}`,
                    "",
                    "確認ポイント:",
                    ...state.report.checkpoints.map((item) => `- ${item}`),
                  ].join("\n"),
                )
              }
              color="primary"
              size="sm"
            >
              この調査から問い合わせを作成
            </Button>
            <Button as={NextLink} href="/support/new" size="sm" variant="bordered">
              メールを取り込む
            </Button>
          </div>
          {state.similar.length > 0 ? (
            <RelatedSupportThreads
              title="似ている過去の問い合わせ"
              items={state.similar.map((item) => ({
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
        </div>
      ) : null}
    </PageShell>
  );
}
