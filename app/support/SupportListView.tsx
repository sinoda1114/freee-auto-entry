"use client";

import { Button, Chip, Input, Select, SelectItem } from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import type { SupportThread } from "@/lib/db/support-threads";
import {
  SUPPORT_THREAD_CATEGORIES,
  supportThreadCategoryLabel,
} from "@/lib/support/categories";

const STATUS_LABEL: Record<SupportThread["status"], string> = {
  open: "未解決",
  resolved: "解決済み",
  follow_up: "要フォロー",
};

function statusColor(
  status: SupportThread["status"],
): "warning" | "success" | "primary" {
  if (status === "resolved") return "success";
  if (status === "follow_up") return "primary";
  return "warning";
}

export function SupportListView({
  companyId,
  threads,
  initialQuery,
  initialStatus,
  initialCategory,
  initialTarget,
}: {
  companyId: string;
  threads: SupportThread[];
  initialQuery: string;
  initialStatus: string;
  initialCategory: string;
  initialTarget: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus || "all");
  const [category, setCategory] = useState(initialCategory || "all");
  const [isPending, startTransition] = useTransition();

  function applyFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    if (category !== "all") params.set("category", category);
    if (initialTarget) params.set("target", initialTarget);
    startTransition(() => {
      router.push(`/support?${params.toString()}`);
    });
  }

  return (
    <PageShell width="xl">
      <PageHeader
        title="問い合わせ履歴"
        description="freeeサポートへの問い合わせを検索・蓄積します"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              as={NextLink}
              href="/support/investigate"
              size="sm"
              variant="bordered"
            >
              問い合わせ前に調査
            </Button>
            <Button as={NextLink} href="/support/new" color="primary" size="sm">
              メールを取り込む
            </Button>
          </div>
        }
      />

      <div className="panel mt-4 space-y-3 px-4 py-4">
        <input type="hidden" value={companyId} readOnly />
        <div className="grid gap-2 md:grid-cols-[1fr_8rem_8rem_auto]">
          <Input
            aria-label="キーワード検索"
            placeholder="件名・要約・タグで検索"
            value={query}
            onValueChange={setQuery}
            size="sm"
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
              }
            }}
          />
          <Select
            aria-label="状態"
            selectedKeys={new Set([status])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (typeof value === "string") setStatus(value);
            }}
            size="sm"
            variant="bordered"
          >
            <SelectItem key="all">すべての状態</SelectItem>
            <SelectItem key="open">未解決</SelectItem>
            <SelectItem key="resolved">解決済み</SelectItem>
            <SelectItem key="follow_up">要フォロー</SelectItem>
          </Select>
          <Select
            aria-label="カテゴリ"
            items={[
              { value: "all", label: "すべてのカテゴリ" },
              ...SUPPORT_THREAD_CATEGORIES,
            ]}
            selectedKeys={new Set([category])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (typeof value === "string") setCategory(value);
            }}
            size="sm"
            variant="bordered"
          >
            {(item) => <SelectItem key={item.value}>{item.label}</SelectItem>}
          </Select>
          <Button
            color="primary"
            size="sm"
            isLoading={isPending}
            onPress={applyFilters}
          >
            検索
          </Button>
        </div>
        {initialTarget ? (
          <p className="text-xs text-[var(--freee-text-muted)]">
            freee 対象フィルタ: {initialTarget}
          </p>
        ) : null}
      </div>

      <div className="panel mt-4 divide-y divide-[var(--freee-border)]">
        {threads.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--freee-text-muted)]">
            問い合わせがありません。メールを取り込むか、問い合わせ前調査から作成してください。
          </p>
        ) : (
          threads.map((thread) => (
            <NextLink
              key={thread.id}
              href={`/support/${thread.id}`}
              className="flex flex-col gap-1.5 px-4 py-3 transition hover:bg-[var(--freee-bg)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--freee-text)]">
                  {thread.subject}
                </p>
                <Chip size="sm" variant="flat" color={statusColor(thread.status)}>
                  {STATUS_LABEL[thread.status]}
                </Chip>
                <Chip size="sm" variant="flat">
                  {supportThreadCategoryLabel(thread.category)}
                </Chip>
              </div>
              <p className="truncate text-xs text-[var(--freee-text-muted)]">
                {thread.questionSummary}
              </p>
              {thread.tags.length > 0 ? (
                <p className="text-[11px] text-[var(--freee-text-muted)]">
                  {thread.tags.map((tag) => `#${tag}`).join(" ")}
                </p>
              ) : null}
            </NextLink>
          ))
        )}
      </div>
    </PageShell>
  );
}
