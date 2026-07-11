"use client";

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
    <form
      action={formAction}
      className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="templateId" value={template.id} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold">
          対象月
          <input
            type="month"
            name="targetMonth"
            defaultValue={currentMonth}
            required
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          請求日
          <input
            type="date"
            name="billingDate"
            defaultValue={today}
            required
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          入金期日
          <input
            type="date"
            name="paymentDate"
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-3">
          件名
          <input
            name="subject"
            defaultValue={template.subject}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          送付先 TO
          <input
            name="emailTo"
            type="email"
            defaultValue={template.emailTo}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          送付先 CC
          <input
            name="emailCc"
            defaultValue={template.emailCc}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-lg font-black">今回の請求明細</legend>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-[1fr_7rem_9rem_7rem] dark:bg-slate-900"
          >
            <label className="grid gap-1 text-xs font-bold">
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
                className="rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
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
                className="rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
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
                className="rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
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
                className="rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="10">10%</option>
                <option value="8">8%</option>
                <option value="0">0%</option>
              </select>
            </label>
          </div>
        ))}
      </fieldset>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <label className="flex items-start gap-2 font-semibold">
          <input
            type="checkbox"
            name="confirmed"
            required
            className="mt-1 size-4 accent-lime-600"
          />
          上記内容でfreeeに請求書を作成します。メール送信は行われず、送付はfreee画面で行います。
        </label>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-lime-500 px-5 py-3 font-black text-slate-950 hover:bg-lime-400 disabled:opacity-50"
      >
        {isPending ? "作成中..." : "確認して請求書を作成"}
      </button>
      {state.message && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-lg p-4 ${
            state.status === "success"
              ? "bg-green-50 text-green-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          <p>{state.message}</p>
          {state.reportUrl && (
            <a
              href={state.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-bold underline"
            >
              freeeで確認・送付する ↗
            </a>
          )}
        </div>
      )}
    </form>
  );
}
