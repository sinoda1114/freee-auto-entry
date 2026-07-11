"use client";

import { Button } from "@heroui/react";
import { useActionState, useState } from "react";
import type {
  InvoiceTemplateLine,
  RecurringInvoiceTemplate,
} from "@/lib/db/recurring-invoices";
import { formatTokyoDate, formatTokyoMonth } from "@/lib/date";
import {
  generateRecurringInvoiceAction,
  type GenerateInvoiceState,
} from "./actions";

const initialState: GenerateInvoiceState = { status: "idle" };

export function GenerateInvoiceForm({
  companyId,
  template,
}: {
  companyId: string;
  template: RecurringInvoiceTemplate;
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
