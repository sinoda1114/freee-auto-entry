"use client";

import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useActionState, useMemo } from "react";
import {
  buildRuleDraftsFromPreview,
  dedupeRuleDrafts,
  walletBatchCategoryLabel,
  type WalletBatchPreviewItem,
} from "@/lib/freee/wallet-batch";
import { FREEE_WALLET_TXNS_LIST_URL } from "@/lib/freee/wallet-url";
import {
  bulkCreateMatcherRulesAction,
  type BatchMatcherActionState,
} from "./batch-actions";

const initialBatchState: BatchMatcherActionState = { status: "idle" };

const CONDITION_LABELS = {
  0: "部分一致",
  1: "前方一致",
  2: "後方一致",
  3: "完全一致",
} as const;

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function PreviewSection({
  title,
  items,
}: {
  title: string;
  items: WalletBatchPreviewItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--freee-text-muted)]">
        {title}（{items.length}件）
      </h3>
      <ul className="divide-y divide-default-200 rounded-lg border border-[var(--freee-border)]">
        {items.map((item) => (
          <li
            key={item.transaction.id}
            className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="w-[4.75rem] shrink-0 font-mono text-xs tabular-nums">
              {item.transaction.date}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.transaction.description}</p>
              <p className="text-xs text-[var(--freee-text-muted)]">
                {item.matchReason}
                {item.matchedRule
                  ? ` · ${item.matchedRule.accountItemName ?? ""} / ${item.matchedRule.taxName ?? ""}`
                  : item.suggestion
                    ? ` · ${item.suggestion.accountItemName} / ${item.suggestion.taxName} / ${CONDITION_LABELS[item.suggestion.condition]}`
                    : null}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums">
              {formatAmount(item.transaction.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WalletBatchPanel({
  companyId,
  open,
  onClose,
  selectedItems,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  selectedItems: WalletBatchPreviewItem[];
}) {
  const [state, formAction, pending] = useActionState(
    bulkCreateMatcherRulesAction,
    initialBatchState,
  );

  const matchedItems = useMemo(
    () => selectedItems.filter((item) => item.category === "rule_matched"),
    [selectedItems],
  );
  const suggestedItems = useMemo(
    () => selectedItems.filter((item) => item.category === "suggested"),
    [selectedItems],
  );
  const manualItems = useMemo(
    () => selectedItems.filter((item) => item.category === "no_suggestion"),
    [selectedItems],
  );

  const ruleDrafts = useMemo(
    () => dedupeRuleDrafts(buildRuleDraftsFromPreview(suggestedItems)),
    [suggestedItems],
  );

  const showResults = state.status !== "idle" && state.results;

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span>一括プレビュー</span>
              <span className="text-sm font-normal text-[var(--freee-text-muted)]">
                {selectedItems.length}件を選択中
              </span>
            </ModalHeader>
            <ModalBody className="gap-4">
              {showResults ? (
                <div className="space-y-3">
                  <p
                    role="status"
                    className={
                      state.status === "success"
                        ? "rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-200"
                        : "rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger dark:bg-danger-950/30"
                    }
                  >
                    {state.message}
                  </p>
                  <ul className="divide-y divide-default-200 rounded-lg border border-[var(--freee-border)] text-sm">
                    {state.results?.map((result) => (
                      <li key={result.description} className="px-3 py-2">
                        <p className="font-semibold">{result.description}</p>
                        <p className="text-xs text-[var(--freee-text-muted)]">
                          {result.message}
                          {result.affectedTransactionIds.length > 0
                            ? ` · 対象明細 ${result.affectedTransactionIds.length}件`
                            : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-[var(--freee-text-muted)]">
                    freee API では明細の直接登録はできないため、ルール未設定分は自動登録ルールを一括作成し、ルール一致分は freee で確定してください。
                  </p>
                  <PreviewSection
                    title="ルール一致（freeeで確定）"
                    items={matchedItems}
                  />
                  <PreviewSection
                    title="ルール作成候補"
                    items={suggestedItems}
                  />
                  <PreviewSection title="要手動設定" items={manualItems} />

                  {ruleDrafts.length > 0 ? (
                    <form action={formAction} className="space-y-3" id="batch-rule-form">
                      <input type="hidden" name="companyId" value={companyId} />
                      <input
                        type="hidden"
                        name="ruleDrafts"
                        value={JSON.stringify(
                          buildRuleDraftsFromPreview(suggestedItems),
                        )}
                      />
                      <p className="text-xs text-[var(--freee-text-muted)]">
                        重複する条件は {ruleDrafts.length} 件のルールにまとめて作成します。
                      </p>
                      <Checkbox name="confirmed" value="on">
                        上記のルール内容で一括作成することを確認しました
                      </Checkbox>
                    </form>
                  ) : null}

                  {state.status === "error" && !showResults ? (
                    <p role="alert" className="text-sm text-danger">
                      {state.message}
                    </p>
                  ) : null}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              {showResults ? (
                <Button color="primary" onPress={onModalClose}>
                  閉じる
                </Button>
              ) : (
                <>
                  {matchedItems.length > 0 ? (
                    <Button
                      as="a"
                      href={FREEE_WALLET_TXNS_LIST_URL}
                      target="_blank"
                      rel="noreferrer"
                      variant="bordered"
                    >
                      freeeで確定 ↗
                    </Button>
                  ) : null}
                  <Button variant="light" onPress={onModalClose}>
                    キャンセル
                  </Button>
                  {ruleDrafts.length > 0 ? (
                    <Button
                      color="primary"
                      type="submit"
                      form="batch-rule-form"
                      isLoading={pending}
                    >
                      ルールを一括作成（{ruleDrafts.length}件）
                    </Button>
                  ) : null}
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export function WalletBatchFilterBar({
  filter,
  onFilterChange,
  counts,
  selectedCount,
  visibleCount,
  onSelectVisible,
  onClearSelection,
  onOpenPreview,
}: {
  filter: "all" | "rule_matched" | "suggested" | "no_suggestion";
  onFilterChange: (
    value: "all" | "rule_matched" | "suggested" | "no_suggestion",
  ) => void;
  counts: Record<"all" | "rule_matched" | "suggested" | "no_suggestion", number>;
  selectedCount: number;
  visibleCount: number;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onOpenPreview: () => void;
}) {
  const filters = [
    { key: "all" as const, label: "すべて" },
    { key: "rule_matched" as const, label: walletBatchCategoryLabel("rule_matched") },
    { key: "suggested" as const, label: walletBatchCategoryLabel("suggested") },
    { key: "no_suggestion" as const, label: walletBatchCategoryLabel("no_suggestion") },
  ];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {filters.map((item) => (
        <Button
          key={item.key}
          size="sm"
          variant={filter === item.key ? "solid" : "bordered"}
          color={filter === item.key ? "primary" : "default"}
          onPress={() => onFilterChange(item.key)}
        >
          {item.label}
          <span className="ml-1 font-mono text-xs opacity-80">
            {counts[item.key]}
          </span>
        </Button>
      ))}
      <span className="mx-1 hidden h-4 w-px bg-[var(--freee-border)] sm:inline" />
      <Button size="sm" variant="light" onPress={onSelectVisible}>
        表示中を全選択（{visibleCount}）
      </Button>
      {selectedCount > 0 ? (
        <>
          <span className="text-xs text-[var(--freee-text-muted)]">
            {selectedCount}件選択
          </span>
          <Button size="sm" color="primary" onPress={onOpenPreview}>
            一括プレビュー
          </Button>
          <Button size="sm" variant="light" onPress={onClearSelection}>
            選択解除
          </Button>
        </>
      ) : null}
    </div>
  );
}
