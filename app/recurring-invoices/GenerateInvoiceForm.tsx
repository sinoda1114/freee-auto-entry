"use client";

import { Button } from "@heroui/react";
import { useActionState, useMemo, useState } from "react";
import type {
  InvoiceTemplateLine,
  RecurringInvoiceTemplate,
} from "@/lib/db/recurring-invoices";
import { formatTokyoDate, formatTokyoMonth } from "@/lib/date";
import type { InvoiceDetail } from "@/lib/freee/invoice";
import { computeInvoiceDiff } from "@/lib/freee/invoice-diff";
import {
  generateRecurringInvoiceAction,
  type GenerateInvoiceState,
} from "./actions";

const initialState: GenerateInvoiceState = { status: "idle" };

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface DiffWarningProps {
  prevInvoice: InvoiceDetail;
  prevTargetMonth: string;
  currentLines: InvoiceTemplateLine[];
}

function DiffWarning({
  prevInvoice,
  prevTargetMonth,
  currentLines,
}: DiffWarningProps) {
  const diff = useMemo(
    () => computeInvoiceDiff(prevInvoice.lines, currentLines),
    [prevInvoice.lines, currentLines],
  );

  if (!diff.hasAnyChange) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-success-300 bg-success-50 px-3 py-2 text-xs text-success-800 dark:border-success-700 dark:bg-success-950/40 dark:text-success-100">
        前回（{prevTargetMonth}）と内容は同じです。合計{" "}
        <span className="font-semibold">{formatAmount(prevInvoice.totalAmount)}</span>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-warning-300 bg-warning-50 px-3 py-3 text-sm dark:border-warning-700 dark:bg-warning-950/40">
      <p className="mb-2 font-semibold text-warning-900 dark:text-warning-100">
        前回（{prevTargetMonth}）との差分
      </p>
      <div className="grid gap-1">
        {diff.lineChanges.map((change, index) => (
          <div
            key={index}
            className={`flex items-baseline justify-between gap-2 rounded px-2 py-1 text-xs ${
              change.type === "same"
                ? "text-[var(--freee-text-muted)]"
                : change.type === "changed"
                  ? "bg-warning-100 text-warning-900 dark:bg-warning-900/30 dark:text-warning-100"
                  : change.type === "added"
                    ? "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-100"
                    : "bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-100"
            }`}
          >
            <span className="truncate font-medium">{change.description}</span>
            <span className="shrink-0 font-mono">
              {change.type === "changed" && change.prevAmount !== null && (
                <span className="mr-2 line-through opacity-60">
                  {formatAmount(change.prevAmount)}
                </span>
              )}
              {change.type === "removed" && change.prevAmount !== null
                ? formatAmount(change.prevAmount)
                : change.currAmount !== null
                  ? formatAmount(change.currAmount)
                  : ""}
            </span>
          </div>
        ))}
      </div>
      {diff.amountChanged && (
        <p className="mt-2 text-xs font-semibold text-warning-900 dark:text-warning-100">
          合計:{" "}
          <span className="line-through opacity-60">
            {formatAmount(diff.prevTotal)}
          </span>{" "}
          → <span>{formatAmount(diff.currTotal)}</span>
        </p>
      )}
    </div>
  );
}

export function GenerateInvoiceForm({
  companyId,
  template,
  prevInvoice,
  prevTargetMonth,
}: {
  companyId: string;
  template: RecurringInvoiceTemplate;
  prevInvoice?: InvoiceDetail;
  prevTargetMonth?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    generateRecurringInvoiceAction,
    initialState,
  );
  const [lines, setLines] = useState<InvoiceTemplateLine[]>(template.lines);
  const today = formatTokyoDate();
  const currentMonth = formatTokyoMonth();

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="templateId" value={template.id} />

      <div className="grid gap-4 md:grid-cols-3">
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
        <label className="form-label md:col-span-3">
          件名
          <input
            name="subject"
            defaultValue={template.subject}
            className="form-input"
          />
        </label>
        <label className="form-label">
          送付先 TO
          <input
            name="emailTo"
            type="email"
            defaultValue={template.emailTo}
            className="form-input"
          />
        </label>
        <label className="form-label">
          送付先 CC
          <input
            name="emailCc"
            defaultValue={template.emailCc}
            className="form-input"
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="form-section-title">今回の請求明細</legend>
        {lines.map((line, index) => (
          <div key={index} className="form-line-row form-line-row--compact">
            <label className="form-label text-xs">
              摘要
              <input
                name="lineDescription"
                value={line.description}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  )
                }
                required
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              数量
              <input
                type="number"
                step="0.001"
                name="lineQuantity"
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, quantity: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              単価
              <input
                type="number"
                name="lineUnitPrice"
                value={line.unitPrice}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, unitPrice: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              />
            </label>
            <label className="form-label text-xs">
              税率
              <select
                name="lineTaxRate"
                value={line.taxRate}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, taxRate: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="form-input"
              >
                <option value="10">10%</option>
                <option value="8">8%</option>
                <option value="0">0%</option>
              </select>
            </label>
          </div>
        ))}
      </fieldset>

      {prevInvoice && prevTargetMonth && (
        <DiffWarning
          prevInvoice={prevInvoice}
          prevTargetMonth={prevTargetMonth}
          currentLines={lines}
        />
      )}

      <div className="rounded-[var(--radius-panel)] border border-warning-300 bg-warning-50 px-3 py-3 text-sm text-warning-900 dark:border-warning-700 dark:bg-warning-950/40 dark:text-warning-100">
        <label className="flex items-start gap-2 font-medium">
          <input
            type="checkbox"
            name="confirmed"
            required
            className="mt-0.5 size-4 accent-[var(--freee-blue)]"
          />
          上記内容で freee に請求書を作成します。メール送信は行われず、送付は freee
          画面で行います。
        </label>
      </div>
      <Button type="submit" color="primary" isLoading={isPending}>
        確認して請求書を作成
      </Button>
      {state.message && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-[var(--radius-panel)] px-3 py-3 text-sm ${
            state.status === "success"
              ? "bg-success-50 text-success-800 dark:bg-success-950/40 dark:text-success-100"
              : "bg-warning-50 text-warning-900 dark:bg-warning-950/40 dark:text-warning-100"
          }`}
        >
          <p>{state.message}</p>
          {state.reportUrl && (
            <a
              href={state.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-semibold text-[var(--freee-blue)] underline"
            >
              freee で確認・送付する ↗
            </a>
          )}
        </div>
      )}
    </form>
  );
}
