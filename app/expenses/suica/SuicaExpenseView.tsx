"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Checkbox } from "@heroui/react";
import NextLink from "next/link";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
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
  items,
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
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.map((_, i) => i)),
  );
  const [accountItemId, setAccountItemId] = useState(
    defaultAccountItemId != null ? String(defaultAccountItemId) : "",
  );
  const [taxCode, setTaxCode] = useState(
    defaultTaxCode != null ? String(defaultTaxCode) : "",
  );
  const [state, setState] = useState<SuicaExpenseFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  const encodedItems = useMemo(
    () => encodeSuicaHandoffPayload({ v: 1, items }),
    [items],
  );

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
      if (result.registeredIndexes?.length) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const i of result.registeredIndexes!) next.delete(i);
          return next;
        });
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="panel mt-4 px-4 py-4">
        <p className="text-sm text-[var(--freee-text-muted)]">
          引き継いだ交通履歴がありません。Android アプリで Suica
          をかざし、明細を選択してから再度開いてください。
        </p>
        <Button as={NextLink} href="/expenses/new" className="mt-4" size="sm">
          通常の経費登録へ
        </Button>
      </div>
    );
  }

  return (
    <div className="panel mt-4 space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <Checkbox
          isSelected={selected.size === items.length}
          isIndeterminate={selected.size > 0 && selected.size < items.length}
          onValueChange={toggleAll}
        >
          すべて選択（{selected.size}/{items.length}）
        </Checkbox>
      </div>

      <ul className="divide-y divide-[var(--freee-border)]">
        {items.map((item, index) => (
          <li key={`${item.sequence}-${item.date}-${index}`} className="py-3">
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
                <div className="shrink-0 font-medium">{yen(item.amount)}</div>
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
      {state.status === "partial" ? (
        <p className="text-sm text-amber-600" role="alert">
          {state.message}
          {state.dealIds?.length
            ? `（登録済み取引ID: ${state.dealIds.join(", ")}）`
            : null}
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
    </div>
  );
}
