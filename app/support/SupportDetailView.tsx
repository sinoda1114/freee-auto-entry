"use client";

import { Button, Chip } from "@heroui/react";
import NextLink from "next/link";
import { useState } from "react";
import { ConsultationReportView } from "@/app/components/ConsultationReportView";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { SupportInvestigation } from "@/lib/db/support-investigations";
import type { SupportThread } from "@/lib/db/support-threads";
import { supportThreadCategoryLabel } from "@/lib/support/categories";
import {
  freeeRecordLabel,
  freeeRecordUrl,
} from "@/lib/freee/record-url";

const STATUS_LABEL: Record<SupportThread["status"], string> = {
  open: "未解決",
  resolved: "解決済み",
  follow_up: "要フォロー",
};

export function SupportDetailView({
  companyId,
  thread,
  investigations,
}: {
  companyId: string;
  thread: SupportThread;
  investigations: SupportInvestigation[];
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <PageShell width="lg">
      <PageHeader
        title={thread.subject}
        description="問い合わせの詳細と調査履歴"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={NextLink} href="/support" size="sm" variant="light">
              一覧へ
            </Button>
            <Button
              as={NextLink}
              href={`/support/investigate?target=${encodeURIComponent(
                thread.freeeTargetKind && thread.freeeTargetId
                  ? `${thread.freeeTargetKind}:${thread.freeeTargetId}`
                  : "",
              )}&q=${encodeURIComponent(thread.questionSummary)}`}
              size="sm"
              variant="bordered"
            >
              再調査する
            </Button>
          </div>
        }
      />

      <div className="panel mt-4 space-y-3 px-4 py-4">
        <input type="hidden" value={companyId} readOnly />
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" variant="flat">
            {STATUS_LABEL[thread.status]}
          </Chip>
          <Chip size="sm" variant="flat">
            {supportThreadCategoryLabel(thread.category)}
          </Chip>
          {thread.tags.map((tag) => (
            <Chip key={tag} size="sm" variant="bordered">
              #{tag}
            </Chip>
          ))}
        </div>

        <section>
          <h3 className="text-xs font-bold">質問要約</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--freee-text)]">
            {thread.questionSummary}
          </p>
        </section>
        {thread.answerSummary ? (
          <section>
            <h3 className="text-xs font-bold">回答要約</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--freee-text)]">
              {thread.answerSummary}
            </p>
          </section>
        ) : null}
        {thread.background ? (
          <section>
            <h3 className="text-xs font-bold">背景</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--freee-text-muted)]">
              {thread.background}
            </p>
          </section>
        ) : null}
        {thread.conclusion ? (
          <section>
            <h3 className="text-xs font-bold">結論・アクション</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--freee-text)]">
              {thread.conclusion}
            </p>
          </section>
        ) : null}

        {thread.freeeTargetKind && thread.freeeTargetId ? (
          <p className="text-sm">
            <a
              href={freeeRecordUrl(thread.freeeTargetKind, thread.freeeTargetId)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
            >
              {freeeRecordLabel(thread.freeeTargetKind, thread.freeeTargetId)} を
              freeeで開く ↗
            </a>
          </p>
        ) : null}

        {thread.sourceUrl ? (
          <p className="text-sm">
            <a
              href={thread.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--freee-blue)] underline-offset-2 hover:underline"
            >
              Gmailで元メールを開く ↗
            </a>
          </p>
        ) : (
          <p className="text-xs text-[var(--freee-text-muted)]">
            メモとして保存された記録です。
          </p>
        )}

        <div>
          <Button size="sm" variant="light" onPress={() => setShowRaw((v) => !v)}>
            {showRaw ? "元メールを隠す" : "元メールを表示"}
          </Button>
          {showRaw ? (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--freee-bg)] p-3 text-xs text-[var(--freee-text-muted)]">
              {thread.rawEmail}
            </pre>
          ) : null}
        </div>
      </div>

      {investigations.length > 0 ? (
        <div className="panel mt-4 space-y-4 px-4 py-4">
          <h2 className="text-sm font-bold">関連する AI 調査</h2>
          {investigations.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-[var(--freee-border)] px-3 py-3"
            >
              <p className="mb-2 text-xs text-[var(--freee-text-muted)]">
                {item.createdAt} / {item.question}
              </p>
              <ConsultationReportView report={item.report} />
            </div>
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}
