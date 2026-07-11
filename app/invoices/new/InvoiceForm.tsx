"use client";

import { useActionState } from "react";
import type { Partner } from "@/lib/freee/accounting";
import { createInvoiceAction, type InvoiceFormState } from "./actions";

const initialState: InvoiceFormState = { status: "idle" };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceForm({ partners }: { partners: Partner[] }) {
  const [state, formAction, isPending] = useActionState(
    createInvoiceAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          請求日
        </span>
        <input
          type="date"
          name="billingDate"
          defaultValue={todayIsoDate()}
          required
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
          品目・摘要
        </span>
        <input
          type="text"
          name="description"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            数量
          </span>
          <input
            type="number"
            name="quantity"
            min={1}
            defaultValue={1}
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            単価（円）
          </span>
          <input
            type="number"
            name="unitPrice"
            min={1}
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            税率（%）
          </span>
          <select
            name="taxRate"
            defaultValue={10}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value={10}>10%</option>
            <option value={8}>8%（軽減税率）</option>
            <option value={0}>0%</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
      >
        {isPending ? "作成中..." : "作成する"}
      </button>

      {state.status === "success" && (
        <div className="rounded border border-green-600 p-4 text-green-700 dark:border-green-400 dark:text-green-400">
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
        <p className="text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
