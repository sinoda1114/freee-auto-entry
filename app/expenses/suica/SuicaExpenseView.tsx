"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Checkbox } from "@heroui/react";
import NextLink from "next/link";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import {
  isDateInRegistrableRange,
  type RegistrableDateRange,
} from "@/lib/freee/company";
import { parseSuicaCsv } from "@/lib/suica/csv";
import {
  encodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";
import {
  checkSuicaDuplicatesAction,
  createSuicaExpensesAction,
} from "./actions";
import {
  SUICA_EXPENSE_BATCH_LIMIT,
  type SuicaExpenseFormState,
} from "./constants";

const initialState: SuicaExpenseFormState = { status: "idle" };

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function selectableIndexes(
  items: SuicaTransitItem[],
  dateRange: RegistrableDateRange | null,
  alreadyRegistered: ReadonlySet<number>,
): number[] {
  return items
    .map((item, index) => {
      if (!isDateInRegistrableRange(item.date, dateRange)) return -1;
      if (alreadyRegistered.has(index)) return -1;
      return index;
    })
    .filter((index) => index >= 0);
}

export function SuicaExpenseView({
  items: initialItems,
  accountItems,
  taxCodes,
  defaultAccountItemId,
  defaultTaxCode,
  dateRange = null,
}: {
  items: SuicaTransitItem[];
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  defaultAccountItemId: number | null;
  defaultTaxCode: number | null;
  dateRange?: RegistrableDateRange | null;
}) {
  const [items, setItems] = useState<SuicaTransitItem[]>(initialItems);
  const [alreadyRegistered, setAlreadyRegistered] = useState<Set<number>>(
    () => new Set(),
  );
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(selectableIndexes(initialItems, dateRange, new Set())),
  );
  const [accountItemId, setAccountItemId] = useState(
    defaultAccountItemId != null ? String(defaultAccountItemId) : "",
  );
  const [taxCode, setTaxCode] = useState(
    defaultTaxCode != null ? String(defaultTaxCode) : "",
  );
  const [state, setState] = useState<SuicaExpenseFormState>(initialState);
  const [progress, setProgress] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);
  const [isCheckingDupes, setIsCheckingDupes] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const encodedItems = useMemo(
    () => encodeSuicaHandoffPayload({ v: 1, items }),
    [items],
  );

  const selectable = useMemo(
    () => selectableIndexes(items, dateRange, alreadyRegistered),
    [items, dateRange, alreadyRegistered],
  );
  const outOfRangeCount = items.filter(
    (item) => !isDateInRegistrableRange(item.date, dateRange),
  ).length;

  async function refreshDuplicates(
    nextItems: SuicaTransitItem[],
    encoded: string,
  ): Promise<Set<number>> {
    setIsCheckingDupes(true);
    try {
      const result = await checkSuicaDuplicatesAction(encoded);
      if (result.status === "error") {
        setCsvError(result.message ?? "重複確認に失敗しました。");
        return new Set();
      }
      return new Set(result.duplicateIndexes);
    } finally {
      setIsCheckingDupes(false);
    }
  }

  async function applyItems(next: SuicaTransitItem[], infoPrefix?: string) {
    const encoded = encodeSuicaHandoffPayload({ v: 1, items: next });
    setItems(next);
    setState(initialState);
    setProgress(null);
    const dupes = await refreshDuplicates(next, encoded);
    setAlreadyRegistered(dupes);
    setSelected(new Set(selectableIndexes(next, dateRange, dupes)));
    if (infoPrefix) {
      const out = next.filter(
        (item) => !isDateInRegistrableRange(item.date, dateRange),
      ).length;
      const parts = [`${infoPrefix}${next.length} 件`];
      if (out > 0) parts.push(`年度外 ${out} 件`);
      if (dupes.size > 0) parts.push(`登録済み ${dupes.size} 件はスキップ`);
      setCsvInfo(parts.join(" / "));
    }
  }

  useEffect(() => {
    if (initialItems.length === 0) return;
    void (async () => {
      const encoded = encodeSuicaHandoffPayload({ v: 1, items: initialItems });
      const dupes = await refreshDuplicates(initialItems, encoded);
      setAlreadyRegistered(dupes);
      setSelected(new Set(selectableIndexes(initialItems, dateRange, dupes)));
    })();
    // 初回のディープリンク受け取り時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAccountChange(value: string) {
    setAccountItemId(value);
    const item = accountItems.find((a) => String(a.id) === value);
    if (item) {
      const matched = taxCodes.find((t) => t.code === item.defaultTaxCode);
      if (matched) setTaxCode(String(matched.code));
    }
  }

  function toggle(index: number) {
    const item = items[index];
    if (!item || !isDateInRegistrableRange(item.date, dateRange)) return;
    if (alreadyRegistered.has(index)) return;
    setState(initialState);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setState(initialState);
    setSelected(checked ? new Set(selectable) : new Set());
  }

  async function handleCsvFile(file: File | undefined) {
    if (!file) return;
    setCsvError(null);
    setCsvInfo(null);
    try {
      const text = await file.text();
      const parsed = parseSuicaCsv(text);
      await applyItems(parsed, `${file.name} から `);
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : "CSV の読み込みに失敗しました。",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit() {
    const indexes = Array.from(selected)
      .filter((index) => {
        const item = items[index];
        return (
          item != null &&
          isDateInRegistrableRange(item.date, dateRange) &&
          !alreadyRegistered.has(index)
        );
      })
      .sort((a, b) => a - b);
    if (indexes.length === 0) return;

    startTransition(async () => {
      setProgress(null);
      setState(initialState);
      const allDealIds: number[] = [];
      let skippedDuplicates = 0;
      const total = indexes.length;
      const batches = Math.ceil(total / SUICA_EXPENSE_BATCH_LIMIT);

      try {
        for (let batchIndex = 0; batchIndex < batches; batchIndex += 1) {
          const start = batchIndex * SUICA_EXPENSE_BATCH_LIMIT;
          const chunk = indexes.slice(start, start + SUICA_EXPENSE_BATCH_LIMIT);
          const doneBefore = allDealIds.length;
          setProgress(
            `登録中… ${doneBefore}/${total}（${batchIndex + 1}/${batches} バッチ）`,
          );

          const fd = new FormData();
          fd.set("encodedItems", encodedItems);
          fd.set("accountItemId", accountItemId);
          fd.set("taxCode", taxCode);
          fd.set("selectedIndexes", chunk.join(","));

          const result = await createSuicaExpensesAction(initialState, fd);
          if (result.dealIds?.length) {
            allDealIds.push(...result.dealIds);
          }
          skippedDuplicates += result.skippedDuplicateCount ?? 0;

          if (result.status === "error") {
            setProgress(null);
            setState({
              ...result,
              dealIds: allDealIds,
              registeredCount: allDealIds.length,
              skippedDuplicateCount: skippedDuplicates,
              message:
                allDealIds.length > 0
                  ? `${allDealIds.length}/${total} 件まで登録したあと失敗: ${result.message}`
                  : result.message,
            });
            return;
          }
        }

        setProgress(null);
        const skipNote =
          skippedDuplicates > 0
            ? `（重複 ${skippedDuplicates} 件はスキップ）`
            : "";
        setState({
          status: "success",
          dealIds: allDealIds,
          registeredCount: allDealIds.length,
          skippedDuplicateCount: skippedDuplicates,
          message: `${allDealIds.length}件の経費を登録しました。${skipNote}`,
        });
        setSelected(new Set());
        // 登録後は指紋が増えるので再照合
        const dupes = await refreshDuplicates(items, encodedItems);
        setAlreadyRegistered(dupes);
      } catch (error) {
        setProgress(null);
        const message =
          error instanceof Error
            ? error.message
            : "通信エラーで中断しました。件数を減らして再試行してください。";
        setState({
          status: "error",
          dealIds: allDealIds,
          registeredCount: allDealIds.length,
          message:
            allDealIds.length > 0
              ? `${allDealIds.length}/${total} 件まで登録したあと中断: ${message}`
              : message,
        });
      }
    });
  }

  const batchHint =
    selected.size > SUICA_EXPENSE_BATCH_LIMIT
      ? `選択 ${selected.size} 件 → ${SUICA_EXPENSE_BATCH_LIMIT} 件ずつ自動分割して登録します。`
      : null;

  return (
    <div className="panel mt-4 space-y-4 px-4 py-4">
      <div className="space-y-2 rounded-md border border-dashed border-[var(--freee-border)] p-3">
        <p className="text-sm font-medium text-[var(--freee-text)]">
          CSV から取り込む（USB 不要）
        </p>
        <p className="text-xs text-[var(--freee-text-muted)]">
          Suica 読取アプリや会員サイトなどから書き出した CSV
          を選んでください。すでに freee
          にある明細（日付・金額・内容が同じ）は自動で除外します。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm"
          onChange={(e) => void handleCsvFile(e.target.files?.[0])}
        />
        {isCheckingDupes ? (
          <p className="text-xs text-[var(--freee-text-muted)]">
            freee の既存取引と照合中…
          </p>
        ) : null}
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

      {dateRange ? (
        <p className="text-xs text-[var(--freee-text-muted)]">
          登録できる日付: {dateRange.startDate}〜{dateRange.endDate}
          （現在の会計年度）
        </p>
      ) : null}

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
          {outOfRangeCount > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
              会計年度外の明細が {outOfRangeCount}{" "}
              件あります（選択不可）。
            </p>
          ) : null}
          {alreadyRegistered.size > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
              登録済み（重複）が {alreadyRegistered.size}{" "}
              件あります。再登録しません。
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <Checkbox
              isSelected={
                selectable.length > 0 && selected.size === selectable.length
              }
              isIndeterminate={
                selected.size > 0 && selected.size < selectable.length
              }
              onValueChange={toggleAll}
            >
              未登録をすべて選択（{selected.size}/{selectable.length}）
            </Checkbox>
          </div>

          <ul className="divide-y divide-[var(--freee-border)]">
            {items.map((item, index) => {
              const inRange = isDateInRegistrableRange(item.date, dateRange);
              const registered = alreadyRegistered.has(index);
              const disabled = !inRange || registered;
              return (
                <li
                  key={`${item.sequence}-${item.date}-${index}`}
                  className="py-3"
                >
                  <Checkbox
                    isSelected={selected.has(index)}
                    isDisabled={disabled}
                    onValueChange={() => toggle(index)}
                    classNames={{ label: "w-full" }}
                  >
                    <div className="flex w-full items-start justify-between gap-3 text-sm">
                      <div>
                        <div
                          className={
                            disabled
                              ? "font-medium text-[var(--freee-text-muted)] line-through"
                              : "font-medium text-[var(--freee-text)]"
                          }
                        >
                          {item.description}
                        </div>
                        <div className="text-[var(--freee-text-muted)]">
                          {item.date}
                          {!inRange
                            ? "（会計年度外）"
                            : registered
                              ? "（登録済み）"
                              : ""}
                        </div>
                      </div>
                      <div className="shrink-0 font-medium">
                        {yen(item.amount)}
                      </div>
                    </div>
                  </Checkbox>
                </li>
              );
            })}
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

          {batchHint ? (
            <p className="text-xs text-[var(--freee-text-muted)]">{batchHint}</p>
          ) : null}
          {progress ? (
            <p className="text-sm text-[var(--freee-text)]" role="status">
              {progress}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-sm text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <div className="space-y-2 rounded-md border border-green-600/40 bg-green-50 px-3 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
              <p role="status" className="font-medium">
                {state.message}
              </p>
              <p>
                freee
                会計に支出取引として保存済みです。確認は次のどちらかです。
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <a
                    className="underline underline-offset-2"
                    href="https://secure.freee.co.jp/deals"
                    target="_blank"
                    rel="noreferrer"
                  >
                    freee会計の「取引」一覧を開く
                  </a>
                  （摘要に「Suica」と出ていれば成功）
                </li>
                {state.dealIds && state.dealIds.length > 0 ? (
                  <li>
                    取引ID（先頭最大5件）:{" "}
                    {state.dealIds.slice(0, 5).join(", ")}
                    {state.dealIds.length > 5
                      ? ` ほか${state.dealIds.length - 5}件`
                      : ""}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <Button
            color="primary"
            isDisabled={
              isPending ||
              isCheckingDupes ||
              selected.size === 0 ||
              !accountItemId ||
              !taxCode
            }
            isLoading={isPending}
            onPress={handleSubmit}
          >
            {isPending
              ? "登録中…"
              : `選択した${selected.size}件を経費登録`}
          </Button>
        </>
      )}
    </div>
  );
}
