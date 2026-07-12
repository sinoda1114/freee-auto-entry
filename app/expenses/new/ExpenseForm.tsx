"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import {
  createExpenseAction,
  ocrReceiptAction,
  type ExpenseFormState,
} from "./actions";

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
  const [isOcrPending, startOcrTransition] = useTransition();

  const [issueDate, setIssueDate] = useState(todayIsoDate());
  const [accountItemId, setAccountItemId] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAccountItemChange(value: string) {
    setAccountItemId(value);
    const item = accountItems.find((i) => String(i.id) === value);
    if (item) {
      const defaultTax = taxCodes.find((t) => t.code === item.defaultTaxCode);
      if (defaultTax) {
        setTaxCode(String(defaultTax.code));
      }
    }
  }

  function handleOcrClick() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setOcrError("ファイルを選択してください。");
      return;
    }
    setOcrError(null);
    setOcrDone(false);

    startOcrTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await ocrReceiptAction(fd);

      if (result.status === "error") {
        setOcrError(result.message ?? "OCR読み取りに失敗しました。");
        return;
      }

      if (result.receiptId) setReceiptId(result.receiptId);

      const ocr = result.ocrResult;
      if (ocr) {
        if (ocr.issueDate) setIssueDate(ocr.issueDate);
        if (ocr.amount) setAmount(String(ocr.amount));
        if (ocr.description) setDescription(ocr.description);
        if (ocr.accountItemName) {
          const matched = accountItems.find(
            (i) => i.name === ocr.accountItemName,
          );
          if (matched) {
            setAccountItemId(String(matched.id));
            const defaultTax = taxCodes.find(
              (t) => t.code === matched.defaultTaxCode,
            );
            if (defaultTax) setTaxCode(String(defaultTax.code));
          }
        }
      }

      setOcrDone(true);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* 証憑ファイルアップロード */}
      <div className="flex flex-col gap-2 rounded border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          領収書・証憑（任意）
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="text-sm text-zinc-700 dark:text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:file:bg-zinc-800"
        />
        <button
          type="button"
          disabled={isOcrPending}
          onClick={handleOcrClick}
          className="w-fit rounded bg-zinc-100 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {isOcrPending ? "読み取り中..." : "OCRで自動入力"}
        </button>
        {ocrError && (
          <p className="text-sm text-red-600 dark:text-red-400">{ocrError}</p>
        )}
        {ocrDone && !ocrError && (
          <p className="text-sm text-green-600 dark:text-green-400">
            読み取り完了。内容を確認してから登録してください。
          </p>
        )}
        {receiptId && (
          <input type="hidden" name="receiptId" value={receiptId} />
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          発生日
        </span>
        <input
          type="date"
          name="issueDate"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
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
          value={accountItemId}
          onChange={(e) => handleAccountItemChange(e.target.value)}
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
          value={taxCode}
          onChange={(e) => setTaxCode(e.target.value)}
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
