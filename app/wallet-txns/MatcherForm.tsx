"use client";

import { useActionState } from "react";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import type { WalletTransaction } from "@/lib/freee/wallet";
import { createMatcherAction, type MatcherActionState } from "./actions";

const initialState: MatcherActionState = { status: "idle" };

export function MatcherForm({
  companyId,
  transaction,
  walletableName,
  accountItems,
  taxCodes,
}: {
  companyId: string;
  transaction: WalletTransaction;
  walletableName: string;
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
}) {
  const [state, formAction, isPending] = useActionState(
    createMatcherAction,
    initialState,
  );

  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-bold text-white hover:bg-lime-600 hover:text-slate-950">
        恒久ルールを作る
      </summary>
      <form
        action={formAction}
        className="mt-3 grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-950/30"
      >
        <input type="hidden" name="companyId" value={companyId} />
        <input
          type="hidden"
          name="description"
          value={transaction.description}
        />
        <input
          type="hidden"
          name="entrySide"
          value={transaction.entrySide}
        />
        <input type="hidden" name="walletable" value={walletableName} />

        <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
          この操作は今回だけの登録ではありません。今後も一致する明細を自動登録します。
        </p>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">一致方法</span>
          <select
            name="condition"
            defaultValue="3"
            className="rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="3">完全一致</option>
            <option value="0">部分一致</option>
            <option value="1">前方一致</option>
            <option value="2">後方一致</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">勘定科目</span>
          <select
            name="accountItemName"
            required
            className="rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">選択してください</option>
            {accountItems.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">税区分</span>
          <select
            name="taxName"
            required
            className="rounded border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">選択してください</option>
            {taxCodes.map((tax) => (
              <option key={tax.code} value={tax.name}>
                {tax.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="confirmed"
            required
            className="mt-1 size-4 accent-lime-600"
          />
          今後「{transaction.description}」に一致する明細を自動登録することを確認しました
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-amber-500 px-4 py-2 font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isPending ? "作成中..." : "恒久ルールを作成"}
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
    </details>
  );
}
