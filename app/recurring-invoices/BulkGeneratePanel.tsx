"use client";

import { Button, Checkbox, Chip } from "@heroui/react";
import { useActionState, useState } from "react";
import type { RecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import { formatTokyoDate, formatTokyoMonth } from "@/lib/date";
import {
  bulkGenerateRecurringInvoicesAction,
  type BulkGenerateState,
} from "./actions";

const initialState: BulkGenerateState = { status: "idle" };

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface BulkGeneratePanelProps {
  companyId: string;
  templates: RecurringInvoiceTemplate[];
}

export function BulkGeneratePanel({
  companyId,
  templates,
}: BulkGeneratePanelProps) {
  const activeTemplates = templates.filter((t) => t.active);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(activeTemplates.map((t) => t.id)),
  );
  const today = formatTokyoDate();
  const currentMonth = formatTokyoMonth();
  const [state, formAction, isPending] = useActionState(
    bulkGenerateRecurringInvoicesAction,
    initialState,
  );

  if (activeTemplates.length === 0) return null;

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === activeTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeTemplates.map((t) => t.id)));
    }
  }

  const successCount =
    state.results?.filter((r) => r.status === "success").length ?? 0;
  const dupCount =
    state.results?.filter((r) => r.status === "duplicate").length ?? 0;
  const errorCount =
    state.results?.filter((r) => r.status === "error" || r.status === "skipped")
      .length ?? 0;

  return (
    <div className="mt-4">
      {!open ? (
        <Button
          variant="bordered"
          size="sm"
          onPress={() => setOpen(true)}
        >
          一括生成する
        </Button>
      ) : (
        <div className="panel border border-[var(--freee-border)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--freee-text)]">
              一括請求書生成
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--freee-text-muted)] hover:text-[var(--freee-text)]"
            >
              閉じる
            </button>
          </div>

          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="companyId" value={companyId} />
            <input
              type="hidden"
              name="templateIds"
              value={JSON.stringify([...selectedIds])}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <label className="form-label">
                対象月
                <input
                  type="month"
                  name="targetMonth"
                  defaultValue={currentMonth}
                  required
                  className="form-input"
                />
              </label>
              <label className="form-label">
                請求日
                <input
                  type="date"
                  name="billingDate"
                  defaultValue={today}
                  required
                  className="form-input"
                />
              </label>
              <label className="form-label">
                入金期日
                <input
                  type="date"
                  name="paymentDate"
                  className="form-input"
                />
              </label>
            </div>

            <fieldset>
              <legend className="form-section-title mb-2">
                生成するテンプレート
              </legend>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-[var(--freee-blue)] hover:underline"
                >
                  {selectedIds.size === activeTemplates.length
                    ? "全て解除"
                    : "全て選択"}
                </button>
              </div>
              <div className="grid gap-1.5">
                {activeTemplates.map((template) => {
                  const subtotal = template.lines.reduce(
                    (sum, line) => sum + line.quantity * line.unitPrice,
                    0,
                  );
                  return (
                    <label
                      key={template.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--freee-bg-hover)]"
                    >
                      <Checkbox
                        isSelected={selectedIds.has(template.id)}
                        onValueChange={() => toggleId(template.id)}
                        size="sm"
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{template.name}</span>
                        <span className="ml-2 text-xs text-[var(--freee-text-muted)]">
                          {template.partnerName} / {formatAmount(subtotal)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-[var(--radius-panel)] border border-warning-300 bg-warning-50 px-3 py-3 text-sm text-warning-900 dark:border-warning-700 dark:bg-warning-950/40 dark:text-warning-100">
              <label className="flex items-start gap-2 font-medium">
                <input
                  type="checkbox"
                  name="confirmed"
                  required
                  className="mt-0.5 size-4 accent-[var(--freee-blue)]"
                />
                選択した{selectedIds.size}件のテンプレートで請求書を一括作成します。各テンプレートのデフォルト明細が使用されます。
              </label>
            </div>

            {state.status === "error" && state.message && (
              <div
                role="alert"
                className="rounded-[var(--radius-panel)] bg-danger-50 px-3 py-2 text-sm text-danger-800 dark:bg-danger-950/40 dark:text-danger-100"
              >
                {state.message}
              </div>
            )}

            <Button
              type="submit"
              color="primary"
              isLoading={isPending}
              isDisabled={selectedIds.size === 0}
            >
              {selectedIds.size}件を一括生成する
            </Button>
          </form>

          {state.status === "done" && state.results && (
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                {successCount > 0 && (
                  <Chip size="sm" color="success" variant="flat">
                    作成成功 {successCount}件
                  </Chip>
                )}
                {dupCount > 0 && (
                  <Chip size="sm" color="warning" variant="flat">
                    作成済み {dupCount}件
                  </Chip>
                )}
                {errorCount > 0 && (
                  <Chip size="sm" color="danger" variant="flat">
                    エラー {errorCount}件
                  </Chip>
                )}
              </div>
              <div className="grid gap-1.5">
                {state.results.map((result) => (
                  <div
                    key={result.templateId}
                    className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
                      result.status === "success"
                        ? "bg-success-50 text-success-800 dark:bg-success-950/40 dark:text-success-100"
                        : result.status === "duplicate"
                          ? "bg-warning-50 text-warning-900 dark:bg-warning-950/40 dark:text-warning-100"
                          : "bg-danger-50 text-danger-800 dark:bg-danger-950/40 dark:text-danger-100"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{result.templateName}</span>
                      <span className="ml-2">{result.message}</span>
                    </div>
                    {result.reportUrl && (
                      <a
                        href={result.reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 font-semibold text-[var(--freee-blue)] underline"
                      >
                        freeeで確認 ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
