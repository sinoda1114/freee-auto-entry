"use client";

import { useActionState, useState } from "react";
import { formatTokyoDate } from "@/lib/date";
import type { Partner } from "@/lib/freee/accounting";
import { createInvoiceAction, type InvoiceFormState } from "./actions";

const initialState: InvoiceFormState = { status: "idle" };

export function InvoiceForm({
  partners,
  companyId,
}: {
  partners: Partner[];
  companyId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createInvoiceAction,
    initialState,
  );
  const [lines, setLines] = useState([
    {
      key: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 10,
    },
  ]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          請求日
        </span>
        <input
          type="date"
          name="billingDate"
          defaultValue={formatTokyoDate()}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          入金期日
        </span>
        <input
          type="date"
          name="paymentDate"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          取引先
        </span>
        <select
          name="partnerId"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">選択してください</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          件名
        </span>
        <input
          type="text"
          name="subject"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          請求書番号（任意）
        </span>
        <input
          type="text"
          name="invoiceNumber"
          placeholder="自動採番オフ時は必須。空欄なら作成時に自動付与"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            送付先 TO
          </span>
          <input
            type="email"
            name="emailTo"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            送付先 CC
          </span>
          <input
            name="emailCc"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="font-semibold">請求明細</legend>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-[1fr_6rem_8rem_6rem_auto] dark:bg-zinc-900"
          >
            <input
              name="lineDescription"
              aria-label={`摘要 ${index + 1}`}
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
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="number"
              name="lineQuantity"
              aria-label={`数量 ${index + 1}`}
              value={line.quantity}
              min="0.001"
              step="0.001"
              onChange={(event) =>
                setLines((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, quantity: Number(event.target.value) }
                      : item,
                  ),
                )
              }
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="number"
              name="lineUnitPrice"
              aria-label={`単価 ${index + 1}`}
              value={line.unitPrice}
              min="0"
              onChange={(event) =>
                setLines((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, unitPrice: Number(event.target.value) }
                      : item,
                  ),
                )
              }
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <select
              name="lineTaxRate"
              aria-label={`税率 ${index + 1}`}
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
              className="rounded border border-zinc-300 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value={10}>10%</option>
              <option value={8}>8%</option>
              <option value={0}>0%</option>
            </select>
            <button
              type="button"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="rounded border border-zinc-300 px-3 py-2 disabled:opacity-30 dark:border-zinc-700"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                description: "",
                quantity: 1,
                unitPrice: 0,
                taxRate: 10,
              },
            ])
          }
          className="self-start rounded border border-zinc-300 px-4 py-2 text-sm font-bold dark:border-zinc-700"
        >
          ＋ 明細を追加
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
      >
        {isPending ? "作成中..." : "作成する"}
      </button>

      {state.status === "success" && (
        <div
          role="status"
          className="rounded border border-green-600 p-4 text-green-700 dark:border-green-400 dark:text-green-400"
        >
          <p>請求書を作成しました（請求書ID: {state.invoiceId}）。</p>
          <p className="mt-2">
            送付はfreee側の画面から手動で行ってください。
            <a
              className="ml-2 underline"
              href={state.reportUrl}
              target="_blank"
              rel="noreferrer"
            >
              freeeで確認・送付する
            </a>
          </p>
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
