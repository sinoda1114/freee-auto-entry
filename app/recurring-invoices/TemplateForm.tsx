"use client";

import { useActionState, useState } from "react";
import type { RecurringInvoiceTemplate } from "@/lib/db/recurring-invoices";
import type { Partner } from "@/lib/freee/accounting";
import { saveTemplateAction, type TemplateActionState } from "./actions";

const initialState: TemplateActionState = { status: "idle" };

interface EditableLine {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

function emptyLine(): EditableLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 10,
  };
}

export function TemplateForm({
  companyId,
  partners,
  template,
}: {
  companyId: string;
  partners: Partner[];
  template?: RecurringInvoiceTemplate;
}) {
  const [state, formAction, isPending] = useActionState(
    saveTemplateAction,
    initialState,
  );
  const [lines, setLines] = useState<EditableLine[]>(
    template?.lines.map((line) => ({
      ...line,
      key: crypto.randomUUID(),
    })) ?? [emptyLine()],
  );

  const selectedPartner = template
    ? JSON.stringify({ id: template.partnerId, name: template.partnerName })
    : "";

  return (
    <form
      action={formAction}
      className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <input type="hidden" name="companyId" value={companyId} />
      {template && (
        <input type="hidden" name="templateId" value={template.id} />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          管理名
          <input
            name="name"
            defaultValue={template?.name}
            required
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          取引先
          <select
            name="partner"
            defaultValue={selectedPartner}
            required
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          >
            <option value="">選択してください</option>
            {partners.map((partner) => {
              const value = JSON.stringify({
                id: partner.id,
                name: partner.name,
              });
              return (
                <option key={partner.id} value={value}>
                  {partner.name}
                </option>
              );
            })}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">
          件名
          <input
            name="subject"
            defaultValue={template?.subject}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          送付先 TO
          <input
            type="email"
            name="emailTo"
            defaultValue={template?.emailTo}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          送付先 CC
          <input
            name="emailCc"
            defaultValue={template?.emailCc}
            placeholder="複数はカンマ区切り"
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          送付方法
          <select
            name="sendingMethod"
            defaultValue={template?.sendingMethod ?? "email"}
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
          >
            <option value="email">メール</option>
            <option value="posting">郵送</option>
            <option value="email_and_posting">メール＋郵送</option>
          </select>
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-lg font-black">請求明細</legend>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-[1fr_7rem_9rem_7rem_auto] dark:bg-slate-900"
          >
            <label className="grid gap-1 text-xs font-bold">
              摘要
              <input
                name="lineDescription"
                value={line.description}
                required
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  )
                }
                className="rounded border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
              数量
              <input
                type="number"
                name="lineQuantity"
                value={line.quantity}
                min="0.001"
                step="0.001"
                required
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
                min="0"
                required
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
            <button
              type="button"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="self-end rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-30 dark:border-slate-700"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((current) => [...current, emptyLine()])}
          className="justify-self-start rounded-md border border-slate-300 px-4 py-2 text-sm font-bold hover:border-lime-500 dark:border-slate-700"
        >
          ＋ 明細を追加
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-lime-500 px-5 py-3 font-black text-slate-950 hover:bg-lime-400 disabled:opacity-50"
      >
        {isPending ? "保存中..." : template ? "変更を保存" : "定型請求を登録"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "success"
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
