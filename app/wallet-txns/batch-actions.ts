"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db/turso";
import { createMatcherWithLock } from "@/lib/freee/matcher-create-service";
import {
  dedupeRuleDrafts,
  type WalletBatchRuleDraft,
} from "@/lib/freee/wallet-batch";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  getUserMatchers,
  type CreateMatcherCondition,
  type EntrySide,
  type UserMatcher,
} from "@/lib/freee/wallet";

export interface BatchMatcherResultItem {
  description: string;
  status: "success" | "duplicate" | "locked" | "error" | "skipped";
  message: string;
  matcherId?: number;
  affectedTransactionIds: number[];
}

export interface BatchMatcherActionState {
  status: "idle" | "success" | "error";
  message?: string;
  results?: BatchMatcherResultItem[];
}

const MAX_BATCH_RULES = 50;

function parseEntrySide(value: unknown): EntrySide | null {
  return value === "income" || value === "expense" ? value : null;
}

function parseCondition(value: unknown): CreateMatcherCondition | null {
  const condition = Number(value);
  return condition === 0 ||
    condition === 1 ||
    condition === 2 ||
    condition === 3
    ? condition
    : null;
}

async function getAllMatchers(
  auth: { accessToken: string; companyId: string },
): Promise<UserMatcher[]> {
  const all: UserMatcher[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await getUserMatchers(auth, { offset, limit });
    all.push(...page);
    if (page.length < limit) {
      return all;
    }
  }
}

function parseRuleDrafts(raw: string): WalletBatchRuleDraft[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const drafts: WalletBatchRuleDraft[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { transactionId?: unknown }).transactionId !==
        "number" ||
      !parseEntrySide((item as { entrySide?: unknown }).entrySide) ||
      typeof (item as { description?: unknown }).description !== "string" ||
      parseCondition((item as { condition?: unknown }).condition) === null ||
      typeof (item as { accountItemName?: unknown }).accountItemName !==
        "string" ||
      typeof (item as { taxName?: unknown }).taxName !== "string"
    ) {
      return null;
    }
    const entrySide = parseEntrySide(
      (item as { entrySide: unknown }).entrySide,
    )!;
    const condition = parseCondition(
      (item as { condition: unknown }).condition,
    )!;
    const description = (item as { description: string }).description.trim();
    const accountItemName = (
      item as { accountItemName: string }
    ).accountItemName.trim();
    const taxName = (item as { taxName: string }).taxName.trim();
    const walletableRaw = (item as { walletable?: unknown }).walletable;
    const walletable =
      typeof walletableRaw === "string" ? walletableRaw.trim() : undefined;
    if (!description || !accountItemName || !taxName) {
      return null;
    }
    drafts.push({
      transactionId: (item as { transactionId: number }).transactionId,
      entrySide,
      description,
      condition,
      accountItemName,
      taxName,
      ...(walletable ? { walletable } : {}),
    });
  }
  return drafts;
}

function groupDraftsByRule(
  drafts: WalletBatchRuleDraft[],
): Array<{
  rule: Omit<WalletBatchRuleDraft, "transactionId">;
  transactionIds: number[];
}> {
  const groups = new Map<
    string,
    {
      rule: Omit<WalletBatchRuleDraft, "transactionId">;
      transactionIds: number[];
    }
  >();
  for (const draft of drafts) {
    const key = JSON.stringify({
      entrySide: draft.entrySide,
      description: draft.description,
      condition: draft.condition,
      accountItemName: draft.accountItemName,
      taxName: draft.taxName,
      walletable: draft.walletable ?? "",
    });
    const existing = groups.get(key);
    if (existing) {
      existing.transactionIds.push(draft.transactionId);
      continue;
    }
    groups.set(key, {
      rule: {
        entrySide: draft.entrySide,
        description: draft.description,
        condition: draft.condition,
        accountItemName: draft.accountItemName,
        taxName: draft.taxName,
        ...(draft.walletable ? { walletable: draft.walletable } : {}),
      },
      transactionIds: [draft.transactionId],
    });
  }
  return [...groups.values()];
}

export async function bulkCreateMatcherRulesAction(
  _previousState: BatchMatcherActionState,
  formData: FormData,
): Promise<BatchMatcherActionState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeへ再連携してください。" };
  }
  if (String(formData.get("companyId") ?? "") !== auth.companyId) {
    return {
      status: "error",
      message: "事業所が切り替わりました。画面を更新してやり直してください。",
    };
  }
  if (formData.get("confirmed") !== "on") {
    return {
      status: "error",
      message: "内容を確認してチェックを入れてください。",
    };
  }

  const drafts = parseRuleDrafts(String(formData.get("ruleDrafts") ?? ""));
  if (!drafts || drafts.length === 0) {
    return {
      status: "error",
      message: "一括作成するルールがありません。",
    };
  }
  if (drafts.length > MAX_BATCH_RULES) {
    return {
      status: "error",
      message: `一度に作成できるルールは${MAX_BATCH_RULES}件までです。`,
    };
  }

  const uniqueDrafts = dedupeRuleDrafts(drafts);
  const groups = groupDraftsByRule(uniqueDrafts).slice(0, MAX_BATCH_RULES);
  const db = getDatabase();
  let matchers = await getAllMatchers(auth);
  const results: BatchMatcherResultItem[] = [];

  for (const group of groups) {
    const result = await createMatcherWithLock(
      auth,
      db,
      group.rule,
      matchers,
    );
    if (result.status === "success") {
      matchers = [
        ...matchers,
        {
          id: result.matcherId,
          entrySide: group.rule.entrySide,
          description: group.rule.description,
          condition: group.rule.condition,
          priority: 1,
          act: 1,
          accountItemName: group.rule.accountItemName,
          taxName: group.rule.taxName,
          walletable: group.rule.walletable,
          active: true,
        },
      ];
      results.push({
        description: group.rule.description,
        status: "success",
        message: "自動登録ルールを作成しました。",
        matcherId: result.matcherId,
        affectedTransactionIds: group.transactionIds,
      });
      continue;
    }
    results.push({
      description: group.rule.description,
      status: result.status,
      message: result.message,
      affectedTransactionIds: group.transactionIds,
    });
  }

  const successCount = results.filter((item) => item.status === "success").length;
  revalidatePath("/wallet-txns");

  if (successCount === 0) {
    return {
      status: "error",
      message: "ルールを作成できませんでした。",
      results,
    };
  }

  return {
    status: "success",
    message: `${successCount}件の自動登録ルールを作成しました。freeeで未処理明細を確認してください。`,
    results,
  };
}
