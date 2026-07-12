"use client";

import { Button, Chip, Input } from "@heroui/react";
import {
  Fragment,
  useActionState,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import {
  matcherActLabel,
  matcherConditionLabel,
  matcherEntrySideLabel,
} from "@/lib/freee/matcher-labels";
import type { MatcherHistoryEntry } from "@/lib/db/matcher-history";
import type { UserMatcher } from "@/lib/freee/wallet";
import { FREEE_USER_MATCHERS_URL } from "@/lib/freee/wallet-url";
import { WalletTxnSubNav } from "../WalletTxnSubNav";
import {
  toggleMatcherActiveAction,
  updateMatcherFieldsAction,
  type MatcherUpdateState,
} from "./actions";

type ActFilter = "all" | "1" | "0";
type SideFilter = "all" | "income" | "expense";
type ActiveFilter = "active" | "inactive" | "all";

interface RulesViewProps {
  matchers: UserMatcher[];
  history?: MatcherHistoryEntry[];
}

function ToggleActiveButton({
  matcher,
}: {
  matcher: UserMatcher;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(matcher.active);

  const handleToggle = () => {
    const next = !optimisticActive;
    startTransition(async () => {
      setOptimisticActive(next);
      await toggleMatcherActiveAction(matcher.id, next);
    });
  };

  return (
    <Button
      size="sm"
      variant="bordered"
      color={optimisticActive ? "warning" : "success"}
      isLoading={isPending}
      onPress={handleToggle}
      className="min-w-[4.5rem]"
    >
      {optimisticActive ? "無効化" : "有効化"}
    </Button>
  );
}

function EditMatcherRow({
  matcher,
  onClose,
}: {
  matcher: UserMatcher;
  onClose: () => void;
}) {
  const initialState: MatcherUpdateState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(
    updateMatcherFieldsAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <tr className="bg-default-50">
      <td colSpan={7} className="px-3 py-3">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="matcherId" value={matcher.id} />
          <Input
            size="sm"
            name="description"
            label="摘要キーワード"
            labelPlacement="outside"
            defaultValue={matcher.description}
            className="min-w-[12rem] max-w-xs"
            isRequired
          />
          <Input
            size="sm"
            name="accountItemName"
            label="勘定科目"
            labelPlacement="outside"
            defaultValue={matcher.accountItemName ?? ""}
            className="min-w-[10rem] max-w-xs"
            isRequired
          />
          <Input
            size="sm"
            name="taxName"
            label="税区分"
            labelPlacement="outside"
            defaultValue={matcher.taxName ?? ""}
            className="min-w-[10rem] max-w-xs"
            isRequired
          />
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              size="sm"
              color="primary"
              isLoading={isPending}
            >
              保存
            </Button>
            <Button size="sm" variant="bordered" onPress={onClose} type="button">
              キャンセル
            </Button>
          </div>
          {state.status === "error" && state.message && (
            <p className="w-full text-xs text-danger">{state.message}</p>
          )}
        </form>
      </td>
    </tr>
  );
}

export function RulesView({ matchers, history = [] }: RulesViewProps) {
  const [actFilter, setActFilter] = useState<ActFilter>("1");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return matchers
      .filter((matcher) => {
        if (actFilter !== "all" && matcher.act !== Number(actFilter)) {
          return false;
        }
        if (sideFilter !== "all" && matcher.entrySide !== sideFilter) {
          return false;
        }
        if (activeFilter === "active" && !matcher.active) {
          return false;
        }
        if (activeFilter === "inactive" && matcher.active) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        const haystack = [
          matcher.description,
          matcher.accountItemName,
          matcher.taxName,
          matcher.walletable,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => a.priority - b.priority || a.id - b.id);
  }, [actFilter, activeFilter, matchers, query, sideFilter]);

  const activeCount = matchers.filter((m) => m.active).length;
  const inactiveCount = matchers.filter((m) => !m.active).length;
  const autoCount = matchers.filter((m) => m.act === 1 && m.active).length;
  const inferenceCount = matchers.filter((m) => m.act === 0 && m.active).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Accounting rules"
        title="自動登録ルール"
        description={`freee に登録済みのルール ${matchers.length} 件（有効 ${activeCount} / 無効 ${inactiveCount}）。自動登録 ${autoCount} / 推測 ${inferenceCount}。`}
        actions={
          <Button
            as="a"
            href={FREEE_USER_MATCHERS_URL}
            target="_blank"
            rel="noreferrer"
            variant="bordered"
          >
            freeeでルール管理 ↗
          </Button>
        }
      />

      <WalletTxnSubNav />

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Input
          size="sm"
          label="キーワード"
          labelPlacement="outside-left"
          placeholder="摘要・勘定科目で検索"
          value={query}
          onValueChange={setQuery}
          className="min-w-[14rem] max-w-xs"
        />

        <Button
          size="sm"
          variant={actFilter === "1" ? "solid" : "bordered"}
          color={actFilter === "1" ? "primary" : "default"}
          onPress={() => setActFilter("1")}
        >
          自動登録
        </Button>
        <Button
          size="sm"
          variant={actFilter === "0" ? "solid" : "bordered"}
          color={actFilter === "0" ? "primary" : "default"}
          onPress={() => setActFilter("0")}
        >
          推測
        </Button>
        <Button
          size="sm"
          variant={actFilter === "all" ? "solid" : "bordered"}
          color={actFilter === "all" ? "primary" : "default"}
          onPress={() => setActFilter("all")}
        >
          すべて
        </Button>

        <Button
          size="sm"
          variant={sideFilter === "expense" ? "solid" : "bordered"}
          color={sideFilter === "expense" ? "primary" : "default"}
          onPress={() => setSideFilter("expense")}
        >
          出金
        </Button>
        <Button
          size="sm"
          variant={sideFilter === "income" ? "solid" : "bordered"}
          color={sideFilter === "income" ? "primary" : "default"}
          onPress={() => setSideFilter("income")}
        >
          入金
        </Button>
        <Button
          size="sm"
          variant={sideFilter === "all" ? "solid" : "bordered"}
          color={sideFilter === "all" ? "primary" : "default"}
          onPress={() => setSideFilter("all")}
        >
          入出金すべて
        </Button>

        <Button
          size="sm"
          variant={activeFilter === "active" ? "solid" : "bordered"}
          color={activeFilter === "active" ? "success" : "default"}
          onPress={() => setActiveFilter("active")}
        >
          有効
        </Button>
        <Button
          size="sm"
          variant={activeFilter === "inactive" ? "solid" : "bordered"}
          color={activeFilter === "inactive" ? "warning" : "default"}
          onPress={() => setActiveFilter("inactive")}
        >
          無効
        </Button>
        <Button
          size="sm"
          variant={activeFilter === "all" ? "solid" : "bordered"}
          color={activeFilter === "all" ? "primary" : "default"}
          onPress={() => setActiveFilter("all")}
        >
          有効/無効すべて
        </Button>
      </div>

      <div className="panel mt-4 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-[var(--freee-text-muted)]">
            条件に一致するルールはありません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--freee-border)] bg-[var(--freee-bg)] text-left text-xs text-[var(--freee-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">優先度</th>
                  <th className="px-3 py-2 font-semibold">摘要キーワード</th>
                  <th className="px-3 py-2 font-semibold">一致</th>
                  <th className="px-3 py-2 font-semibold">勘定科目 / 税区分</th>
                  <th className="px-3 py-2 font-semibold">口座</th>
                  <th className="px-3 py-2 font-semibold">種別</th>
                  <th className="px-3 py-2 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {filtered.map((matcher) => (
                  <Fragment key={matcher.id}>
                    <tr
                      className={`align-top ${!matcher.active ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {matcher.priority}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{matcher.description}</p>
                        <p className="text-xs text-[var(--freee-text-muted)]">
                          {matcherEntrySideLabel(matcher.entrySide)}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {matcherConditionLabel(matcher.condition)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {matcher.accountItemName ?? "—"}
                        <span className="text-[var(--freee-text-muted)]">
                          {" "}
                          / {matcher.taxName ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--freee-text-muted)]">
                        {matcher.walletable ?? "すべて"}
                      </td>
                      <td className="px-3 py-2">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={matcher.act === 1 ? "primary" : "default"}
                        >
                          {matcherActLabel(matcher.act)}
                        </Chip>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <ToggleActiveButton matcher={matcher} />
                          {matcher.active && (
                            <Button
                              size="sm"
                              variant="bordered"
                              onPress={() =>
                                setEditingId(
                                  editingId === matcher.id ? null : matcher.id,
                                )
                              }
                            >
                              {editingId === matcher.id ? "閉じる" : "編集"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === matcher.id && (
                      <EditMatcherRow
                        matcher={matcher}
                        onClose={() => setEditingId(null)}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-[var(--freee-text-muted)]">
            ルール作成履歴（直近 {history.length} 件）
          </h2>
          <div className="panel overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--freee-border)] bg-[var(--freee-bg)] text-left text-xs text-[var(--freee-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">作成日時</th>
                    <th className="px-3 py-2 font-semibold">摘要</th>
                    <th className="px-3 py-2 font-semibold">勘定科目 / 税区分</th>
                    <th className="px-3 py-2 font-semibold">入出金</th>
                    <th className="px-3 py-2 font-semibold">ルールID</th>
                    <th className="px-3 py-2 font-semibold">作成元</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {history.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-2 text-xs text-[var(--freee-text-muted)]">
                        {new Date(entry.createdAt).toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {entry.description}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {entry.accountItemName}
                        <span className="text-[var(--freee-text-muted)]">
                          {" "}
                          / {entry.taxName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {entry.entrySide === "income" ? "入金" : "出金"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--freee-text-muted)]">
                        {entry.matcherId}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--freee-text-muted)]">
                        {entry.source ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}
