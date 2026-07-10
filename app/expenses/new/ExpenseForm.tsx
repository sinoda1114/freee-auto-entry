"use client";

import { useActionState } from "react";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { createExpenseAction, type ExpenseFormState } from "./actions";

const initialState: ExpenseFormState = { status: "idle" };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  accountItems,
  taxCodes,
}: {
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
}) {
  const [state, formAction, isPending] = useActionState(
    createExpenseAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          発生日
        </span>
        <input
          type="date"
          name="issueDate"
          defaultValue={todayIsoDate()}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          勘定科目
        </span>
        <select
          name="accountItemId"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">選択してください</option>
          {accountItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          税区分
        </span>
        <select
          name="taxCode"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">選択してください</option>
          {taxCodes.map((tax) => (
            <option key={tax.code} value={tax.code}>
              {tax.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          金額（円）
        </span>
        <input
          type="number"
          name="amount"
          min={1}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          摘要
        </span>
        <input
          type="text"
          name="description"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
      >
        {isPending ? "登録中..." : "登録する"}
      </button>

      {state.status === "success" && (
        <p className="text-green-600 dark:text-green-400">
          登録しました（取引ID: {state.dealId}）。
          <a
            className="ml-2 underline"
            href={`https://secure.freee.co.jp/deals#deal_id=${state.dealId}`}
            target="_blank"
            rel="noreferrer"
          >
            freeeで確認
          </a>
        </p>
      )}
      {state.status === "error" && (
        <p className="text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
