"use client";

import { Autocomplete, AutocompleteItem, Button, Tooltip } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useActionState, useMemo, useState } from "react";
import {
  resolveTaxNameForAccountItem,
  type AccountItem,
  type TaxCode,
} from "@/lib/freee/accounting";
import {
  matcherSuggestionSourceLabel,
  suggestMatcherFields,
} from "@/lib/freee/matcher-suggestion";
import type { CreateMatcherCondition, UserMatcher, WalletTransaction } from "@/lib/freee/wallet";
import { createMatcherAction, type MatcherActionState } from "./actions";
import { requestLlmMatcherSuggestionAction } from "./llm-suggestion-action";

const initialState: MatcherActionState = { status: "idle" };

const fieldClassName =
  "w-full rounded-lg border border-[var(--freee-border)] bg-[var(--freee-surface)] px-3 py-1.5 text-sm text-[var(--freee-text)] outline-none focus:border-[var(--freee-blue)]";

const CONDITION_LABELS: Record<CreateMatcherCondition, string> = {
  0: "部分一致",
  1: "前方一致",
  2: "後方一致",
  3: "完全一致",
};

const MATCH_CONDITION_HELP = (
  <div className="max-w-xs space-y-1.5 text-left text-xs leading-relaxed">
    <p>
      明細の摘要を、自動登録ルールの文言とどう比べるかを選びます。
    </p>
    <ul className="list-disc space-y-0.5 pl-3.5">
      <li>完全一致: 摘要が文言とまったく同じときだけ</li>
      <li>部分一致: 摘要のどこかに文言が含まれるとき</li>
      <li>前方一致: 摘要が文言で始まるとき</li>
      <li>後方一致: 摘要が文言で終わるとき</li>
    </ul>
  </div>
);

type AppliedSuggestion = {
  accountItemName: string;
  taxName: string;
  condition: CreateMatcherCondition;
  reasoning?: string;
  source: "freee" | "ai";
};

const CANDIDATE_RANK_LABELS = ["第1候補", "第2候補", "第3候補"] as const;

function SuggestionCard({
  suggestion,
  rank,
  selected = false,
  selectable = false,
  onSelect,
}: {
  suggestion: AppliedSuggestion;
  rank: number;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
}) {
  const rankLabel = CANDIDATE_RANK_LABELS[rank - 1] ?? `第${rank}候補`;
  const sourceLabel =
    suggestion.source === "ai"
      ? selected
        ? "フォームに入力済み"
        : "クリックでフォームに反映"
      : "freeeの既存ルールから自動入力";

  const content = (
    <>
      <p className="text-[11px] font-semibold tracking-wide text-[var(--freee-blue)]">
        {rankLabel}
        <span className="font-normal text-[var(--freee-text-muted)]">
          {" "}
          · {sourceLabel}
        </span>
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--freee-text)]">
        {suggestion.accountItemName}
        <span className="mx-1.5 font-normal text-[var(--freee-text-muted)]">/</span>
        {suggestion.taxName}
        <span className="mx-1.5 font-normal text-[var(--freee-text-muted)]">/</span>
        {CONDITION_LABELS[suggestion.condition]}
      </p>
      {suggestion.reasoning ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--freee-text-muted)]">
          {suggestion.reasoning}
        </p>
      ) : null}
    </>
  );

  if (!selectable) {
    return (
      <div className="rounded-md border border-[var(--freee-border)] bg-[color-mix(in_srgb,var(--freee-blue)_7%,var(--freee-surface))] px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        selected
          ? "border-[var(--freee-blue)] bg-[color-mix(in_srgb,var(--freee-blue)_12%,var(--freee-surface))] ring-1 ring-[var(--freee-blue)]/30"
          : "border-[var(--freee-border)] bg-[var(--freee-surface)] hover:border-[var(--freee-blue)]/45 hover:bg-[color-mix(in_srgb,var(--freee-blue)_5%,var(--freee-surface))]"
      }`}
    >
      {content}
    </button>
  );
}

function SuggestionCardList({
  suggestions,
  selectedIndex,
  onSelect,
}: {
  suggestions: AppliedSuggestion[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {suggestions.map((item, index) => (
        <SuggestionCard
          key={`${item.accountItemName}-${item.taxName}-${item.condition}-${index}`}
          suggestion={item}
          rank={index + 1}
          selected={index === selectedIndex}
          selectable={suggestions.length > 1}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  );
}

export function MatcherRuleTrigger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      color={open ? "default" : "primary"}
      variant={open ? "bordered" : "solid"}
      className="shrink-0 font-semibold"
      onPress={onToggle}
    >
      {open ? "閉じる" : "ルール作成"}
    </Button>
  );
}

export function MatcherRulePanel({
  companyId,
  transaction,
  walletableName,
  accountItems,
  taxCodes,
  suggestionMatchers,
  open,
}: {
  companyId: string;
  transaction: WalletTransaction;
  walletableName: string;
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  suggestionMatchers: UserMatcher[];
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <MatcherRulePanelForm
      companyId={companyId}
      transaction={transaction}
      walletableName={walletableName}
      accountItems={accountItems}
      taxCodes={taxCodes}
      suggestionMatchers={suggestionMatchers}
    />
  );
}

function MatcherRulePanelForm({
  companyId,
  transaction,
  walletableName,
  accountItems,
  taxCodes,
  suggestionMatchers,
}: {
  companyId: string;
  transaction: WalletTransaction;
  walletableName: string;
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
  suggestionMatchers: UserMatcher[];
}) {
  const [state, formAction, isPending] = useActionState(
    createMatcherAction,
    initialState,
  );
  const suggestion = useMemo(
    () =>
      suggestMatcherFields(
        transaction,
        suggestionMatchers,
        walletableName,
        accountItems,
        taxCodes,
      ),
    [transaction, suggestionMatchers, walletableName, accountItems, taxCodes],
  );
  const [accountItemName, setAccountItemName] = useState(
    () => suggestion?.accountItemName ?? "",
  );
  const [taxName, setTaxName] = useState(() => suggestion?.taxName ?? "");
  const [condition, setCondition] = useState<CreateMatcherCondition>(
    () => suggestion?.condition ?? 3,
  );
  const [formFieldKey, setFormFieldKey] = useState(0);
  const [llmPending, setLlmPending] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AppliedSuggestion[]>([]);
  const [selectedAiIndex, setSelectedAiIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  function applySuggestionFields(next: {
    accountItemName: string;
    taxName: string;
    condition: CreateMatcherCondition;
  }) {
    setAccountItemName(next.accountItemName);
    setTaxName(next.taxName);
    setCondition(next.condition);
    setFormFieldKey((value) => value + 1);
  }

  function selectAiCandidate(index: number) {
    const candidate = aiSuggestions[index];
    if (!candidate) {
      return;
    }

    setSelectedAiIndex(index);
    applySuggestionFields({
      accountItemName: candidate.accountItemName,
      taxName: candidate.taxName,
      condition: candidate.condition,
    });
  }

  async function handleLlmSuggest() {
    setLlmPending(true);
    setLlmError(null);
    setAiSuggestions([]);
    setSelectedAiIndex(0);

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("description", transaction.description);
    formData.set("entrySide", transaction.entrySide);
    formData.set("walletable", walletableName);
    formData.set("amount", String(transaction.amount));

    try {
      const result = await requestLlmMatcherSuggestionAction(
        { status: "idle" },
        formData,
      );
      if (result.status === "success") {
        const suggestions = result.candidates.map((candidate) => ({
          accountItemName: candidate.accountItemName,
          taxName: candidate.taxName,
          condition: candidate.condition,
          reasoning: candidate.reasoning,
          source: "ai" as const,
        }));
        setAiSuggestions(suggestions);
        applySuggestionFields({
          accountItemName: suggestions[0].accountItemName,
          taxName: suggestions[0].taxName,
          condition: suggestions[0].condition,
        });
      } else if (result.status === "error") {
        setLlmError(result.message);
      }
    } finally {
      setLlmPending(false);
    }
  }

  return (
    <form
      action={formAction}
      className="w-full basis-full grid gap-3 rounded-lg border border-[var(--freee-border)] border-l-[3px] border-l-[var(--freee-blue)] bg-[var(--freee-surface)] p-3 text-left shadow-sm sm:grid-cols-2"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input
        type="hidden"
        name="description"
        value={transaction.description}
      />
      <input type="hidden" name="entrySide" value={transaction.entrySide} />
      <input type="hidden" name="walletable" value={walletableName} />
      <input type="hidden" name="accountItemName" value={accountItemName} />
      <input type="hidden" name="taxName" value={taxName} />

      <div className="space-y-2 sm:col-span-2">
        <p className="text-xs font-semibold text-[var(--freee-text)]">
          今後も一致する明細を自動登録します（今回だけの登録ではありません）。
        </p>
        {suggestion && aiSuggestions.length === 0 ? (
          <SuggestionCard
            suggestion={{
              accountItemName: suggestion.accountItemName,
              taxName: suggestion.taxName,
              condition: suggestion.condition,
              reasoning: `${matcherSuggestionSourceLabel(suggestion.source)}に一致するルールから選びました。`,
              source: "freee",
            }}
            rank={1}
          />
        ) : null}
        {!suggestion && aiSuggestions.length === 0 ? (
          <p className="text-xs text-[var(--freee-text-muted)]">
            freeeに類似する自動登録ルールは見つかりませんでした。AI提案を試すか、勘定科目を検索して選んでください。
          </p>
        ) : null}
        {aiSuggestions.length === 0 ? (
          <Button
            type="button"
            size="md"
            color="primary"
            variant="solid"
            isLoading={llmPending}
            onPress={handleLlmSuggest}
            className="h-10 w-full bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] font-semibold shadow-sm sm:w-auto sm:min-w-[220px]"
          >
            AIに提案してもらう
          </Button>
        ) : (
          <SuggestionCardList
            suggestions={aiSuggestions}
            selectedIndex={selectedAiIndex}
            onSelect={selectAiCandidate}
          />
        )}
        {llmError ? (
          <p role="alert" className="text-xs text-danger">
            {llmError}
          </p>
        ) : null}
      </div>
      <motion.div
        key={formFieldKey}
        initial={
          formFieldKey === 0 || reduceMotion
            ? false
            : {
                opacity: 0.2,
                y: 8,
              }
        }
        animate={{
          opacity: 1,
          y: 0,
          boxShadow:
            formFieldKey === 0 || reduceMotion
              ? "0 0 0 0 transparent"
              : [
                  "0 0 0 0 transparent",
                  "0 0 0 3px color-mix(in srgb, var(--freee-blue) 35%, transparent)",
                  "0 0 0 0 transparent",
                ],
        }}
        transition={{
          opacity: { duration: 0.28, ease: "easeOut" },
          y: { duration: 0.28, ease: "easeOut" },
          boxShadow: { duration: 0.55, ease: "easeOut" },
        }}
        className="col-span-full grid grid-cols-1 gap-3 rounded-md sm:col-span-2 sm:grid-cols-2"
      >
        <div className="grid gap-0.5 text-sm">
          <div className="flex items-center gap-1">
            <label
              htmlFor="matcher-condition"
              className="text-xs font-semibold text-[var(--freee-text)]"
            >
              自動登録ルールの一致方法
            </label>
            <Tooltip
              content={MATCH_CONDITION_HELP}
              placement="top-start"
              size="sm"
              classNames={{
                content:
                  "bg-[var(--freee-surface)] px-3 py-2 text-[var(--freee-text)] shadow-md ring-1 ring-[var(--freee-border)]",
              }}
            >
              <button
                type="button"
                aria-label="自動登録ルールの一致方法の説明"
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-[var(--freee-border)] text-[10px] font-bold leading-none text-[var(--freee-text-muted)] transition hover:border-[var(--freee-blue)]/50 hover:text-[var(--freee-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--freee-blue)]"
              >
                ?
              </button>
            </Tooltip>
          </div>
          <select
            id="matcher-condition"
            name="condition"
            aria-label="自動登録ルールの一致方法"
            value={String(condition)}
            onChange={(event) =>
              setCondition(Number(event.target.value) as CreateMatcherCondition)
            }
            className={fieldClassName}
          >
            <option value="3">完全一致</option>
            <option value="0">部分一致</option>
            <option value="1">前方一致</option>
            <option value="2">後方一致</option>
          </select>
        </div>
        <Autocomplete
          label="勘定科目"
          aria-label="勘定科目"
          placeholder="科目名で検索"
          selectedKey={accountItemName || null}
          inputValue={accountItemName}
          onInputChange={setAccountItemName}
          onSelectionChange={(key) => {
            const nextAccountItemName = key?.toString() ?? "";
            setAccountItemName(nextAccountItemName);
            const nextTaxName = resolveTaxNameForAccountItem(
              nextAccountItemName,
              accountItems,
              taxCodes,
            );
            if (nextTaxName) {
              setTaxName(nextTaxName);
            }
          }}
          isRequired
          size="sm"
          variant="bordered"
          classNames={{
            base: "text-sm",
            listboxWrapper: "max-h-56",
          }}
          inputProps={{
            classNames: {
              inputWrapper:
                "border-[var(--freee-border)] bg-[var(--freee-surface)]",
            },
          }}
        >
          {accountItems.map((item) => (
            <AutocompleteItem key={item.name} textValue={item.name}>
              {item.name}
            </AutocompleteItem>
          ))}
        </Autocomplete>
        <label className="grid gap-0.5 text-sm sm:col-span-2">
          <span className="text-xs font-semibold">税区分</span>
          <select
            name="taxNameDisplay"
            value={taxName}
            onChange={(event) => setTaxName(event.target.value)}
            required
            className={fieldClassName}
          >
            <option value="">選択してください</option>
            {taxCodes.map((tax) => (
              <option key={tax.code} value={tax.name}>
                {tax.name}
              </option>
            ))}
          </select>
        </label>
      </motion.div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="confirmed"
          required
          className="mt-0.5 size-4 shrink-0 rounded border-[var(--freee-border)] accent-[var(--freee-blue)]"
        />
        <span className="text-xs leading-snug">
          今後「{transaction.description}
          」に一致する明細を自動登録することを確認しました
        </span>
      </label>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          color="primary"
          size="sm"
          isLoading={isPending}
          isDisabled={!accountItemName || !taxName}
          className="font-semibold"
        >
          自動登録ルールを作成
        </Button>
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mt-1.5 text-xs ${
              state.status === "success" ? "text-success" : "text-danger"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
