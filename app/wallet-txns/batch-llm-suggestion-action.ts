"use server";

import {
  suggestBatchMatcherRulesWithLlm,
  type MatcherBatchLlmRule,
  type MatcherBatchLlmTransaction,
} from "@/lib/ai/matcher-batch-llm-suggestion";
import { GeminiApiError } from "@/lib/ai/gemini";
import { getAccountItems, getTaxCodes } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import type { EntrySide } from "@/lib/freee/wallet";

export type BatchLlmSuggestionState =
  | { status: "idle" }
  | { status: "success"; rules: MatcherBatchLlmRule[] }
  | { status: "error"; message: string };

function parseTransactions(raw: string): MatcherBatchLlmTransaction[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const transactions: MatcherBatchLlmTransaction[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { id?: unknown }).id !== "number" ||
      typeof (item as { description?: unknown }).description !== "string" ||
      typeof (item as { amount?: unknown }).amount !== "number" ||
      ((item as { entrySide?: unknown }).entrySide !== "income" &&
        (item as { entrySide?: unknown }).entrySide !== "expense") ||
      typeof (item as { walletableName?: unknown }).walletableName !== "string"
    ) {
      return null;
    }
    transactions.push({
      id: (item as { id: number }).id,
      description: (item as { description: string }).description.trim(),
      amount: (item as { amount: number }).amount,
      entrySide: (item as { entrySide: EntrySide }).entrySide,
      walletableName: (item as { walletableName: string }).walletableName.trim(),
    });
  }
  return transactions;
}

export async function requestBatchLlmMatcherSuggestionAction(
  _prevState: BatchLlmSuggestionState,
  formData: FormData,
): Promise<BatchLlmSuggestionState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freee連携が切れています。再ログインしてください。" };
  }

  const companyId = String(formData.get("companyId") ?? "").trim();
  if (companyId !== auth.companyId) {
    return { status: "error", message: "事業所が一致しません。" };
  }

  const transactions = parseTransactions(
    String(formData.get("transactions") ?? ""),
  );
  if (!transactions || transactions.length === 0) {
    return { status: "error", message: "提案対象の明細がありません。" };
  }

  try {
    const [accountItems, taxCodes] = await Promise.all([
      getAccountItems(auth),
      getTaxCodes(auth),
    ]);

    const rules = await suggestBatchMatcherRulesWithLlm(
      transactions,
      accountItems,
      taxCodes,
    );

    return { status: "success", rules };
  } catch (error) {
    if (error instanceof GeminiApiError) {
      return {
        status: "error",
        message:
          error.message === "GEMINI_API_KEY が設定されていません。"
            ? "AI提案は未設定です。GEMINI_API_KEY を環境変数に追加してください。"
            : error.message,
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "AI提案を取得できませんでした。",
    };
  }
}
