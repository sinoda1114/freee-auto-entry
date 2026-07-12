"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button, Checkbox } from "@heroui/react";
import NextLink from "next/link";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import { parseSuicaCsv } from "@/lib/suica/csv";
import {
  encodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";
import {
  createSuicaExpensesAction,
  type SuicaExpenseFormState,
} from "./actions";

const initialState: SuicaExpenseFormState = { status: "idle" };

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function SuicaExpenseView({
  items: initialItems,
  accountItems,
  taxCodes,
  defaultAccountItemId,
  defaultTaxCode,
}: {
  items: SuicaTransitItem[];
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  defaultAccountItemId: number | null;
  defaultTaxCode: number | null;
}) {
  const [items, setItems] = useState<SuicaTransitItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialItems.map((_, i) => i)),
  );
  const [accountItemId, setAccountItemId] = useState(
    defaultAccountItemId != null ? String(defaultAccountItemId) : "",
  );
  const [taxCode, setTaxCode] = useState(
    defaultTaxCode != null ? String(defaultTaxCode) : "",
  );
  const [state, setState] = useState<SuicaExpenseFormState>(initialState);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const encodedItems = useMemo(
    () => encodeSuicaHandoffPayload({ v: 1, items }),
    [items],
  );

  function replaceItems(next: SuicaTransitItem[]) {
    setItems(next);
    setSelected(new Set(next.map((_, i) => i)));
    setState(initialState);
  }

  function handleAccountChange(value: string) {
    setAccountItemId(value);
    const item = accountItems.find((a) => String(a.id) === value);
    if (item) {
      const matched = taxCodes.find((t) => t.code === item.defaultTaxCode);
      if (matched) setTaxCode(String(matched.code));
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((_, i) => i)) : new Set());
  }

  async function handleCsvFile(file: File | undefined) {
    if (!file) return;
    setCsvError(null);
    setCsvInfo(null);
    try {
      const text = await file.text();
      const parsed = parseSuicaCsv(text);
      replaceItems(parsed);
      setCsvInfo(`${file.name} から ${parsed.length} 件読み込みました。`);
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : "CSV の読み込みに失敗しました。",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("encodedItems", encodedItems);
      fd.set("accountItemId", accountItemId);
      fd.set("taxCode", taxCode);
      fd.set(
        "selectedIndexes",
        Array.from(selected).sort((a, b) => a - b).join(","),
      );
      const result = await createSuicaExpensesAction(state, fd);
      setState(result);
    });
  }

  return (
    <div className="panel mt-4 space-y-4 px-4 py-4">
      <div className="space-y-2 rounded-md border border-dashed border-[var(--freee-border)] p-3">
        <p className="text-sm font-medium text-[var(--freee-text)]">
          CSV から取り込む（USB 不要）
        </p>
        <p className="text-xs text-[var(--freee-text-muted)]">
          Suica 読取アプリや会員サイトなどから書き出した CSV
          を選んでください。日付・金額列があれば読み込みます（チャージ行は除外）。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm"
          onChange={(e) => void handleCsvFile(e.target.files?.[0])}
        />
        {csvError ? (
          <p className="text-sm text-red-600" role="alert">
            {csvError}
          </p>
        ) : null}
        {csvInfo ? (
          <p className="text-sm text-green-700" role="status">
            {csvInfo}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--freee-text-muted)]">
            まだ明細がありません。上の CSV
            を選ぶか、Android 専用アプリでかざしたあとにこの画面を開いてください。
          </p>
          <Button as={NextLink} href="/expenses/new" size="sm" variant="flat">
            通常の経費登録へ
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Checkbox
              isSelected={selected.size === items.length}
              isIndeterminate={
                selected.size > 0 && selected.size < items.length
              }
              onValueChange={toggleAll}
            >
              すべて選択（{selected.size}/{items.length}）
            </Checkbox>
          </div>

          <ul className="divide-y divide-[var(--freee-border)]">
            {items.map((item, index) => (
              <li
                key={`${item.sequence}-${item.date}-${index}`}
                className="py-3"
              >
                <Checkbox
                  isSelected={selected.has(index)}
                  onValueChange={() => toggle(index)}
                  classNames={{ label: "w-full" }}
                >
                  <div className="flex w-full items-start justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium text-[var(--freee-text)]">
                        {item.description}
                      </div>
                      <div className="text-[var(--freee-text-muted)]">
                        {item.date}
                      </div>
                    </div>
                    <div className="shrink-0 font-medium">
                      {yen(item.amount)}
                    </div>
                  </div>
                </Checkbox>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--freee-text-muted)]">
                勘定科目
              </span>
              <select
                className="w-full rounded-md border border-[var(--freee-border)] bg-[var(--freee-surface)] px-3 py-2"
                value={accountItemId}
                onChange={(e) => handleAccountChange(e.target.value)}
              >
                <option value="">選択してください</option>
                {accountItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--freee-text-muted)]">
                税区分
              </span>
              <select
                className="w-full rounded-md border border-[var(--freee-border)] bg-[var(--freee-surface)] px-3 py-2"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
              >
                <option value="">選択してください</option>
                {taxCodes.map((tax) => (
                  <option key={tax.code} value={tax.code}>
                    {tax.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.status === "error" ? (
            <p className="text-sm text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-green-700" role="status">
              {state.message}
              {state.dealIds?.length
                ? `（取引ID: ${state.dealIds.join(", ")}）`
                : null}
            </p>
          ) : null}

          <Button
            color="primary"
            isDisabled={
              isPending ||
              selected.size === 0 ||
              !accountItemId ||
              !taxCode ||
              state.status === "success"
            }
            isLoading={isPending}
            onPress={handleSubmit}
          >
            選択した明細を経費登録
          </Button>
        </>
      )}
    </div>
  );
}
