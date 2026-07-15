"use client";

import NextLink from "next/link";
import type { SupportThread } from "@/lib/db/support-threads";

export type RelatedSupportThreadItem = Pick<
  SupportThread,
  "id" | "subject" | "status" | "category" | "questionSummary" | "createdAt"
> & {
  reason?: string;
};

const STATUS_LABEL: Record<SupportThread["status"], string> = {
  open: "未解決",
  resolved: "解決済み",
  follow_up: "要フォロー",
};

export function RelatedSupportThreads({
  title = "関連する問い合わせ",
  items,
  emptyMessage = "関連する問い合わせはありません。",
}: {
  title?: string;
  items: RelatedSupportThreadItem[];
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold text-[var(--freee-text)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--freee-text-muted)]">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <NextLink
                href={`/support/${item.id}`}
                className="block rounded-md border border-[var(--freee-border)] px-3 py-2 transition hover:border-[var(--freee-blue)]/40"
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--freee-text)]">
                    {item.subject}
                  </p>
                  <span className="shrink-0 text-[10px] text-[var(--freee-text-muted)]">
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--freee-text-muted)]">
                  {item.reason ?? item.questionSummary}
                </p>
              </NextLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
