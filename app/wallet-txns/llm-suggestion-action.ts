"use server";

import {
  suggestMatcherFieldsWithLlm,
  type MatcherLlmSuggestion,
} from "@/lib/ai/matcher-llm-suggestion";
import { GeminiApiError } from "@/lib/ai/gemini";
import { getAccountItems, getTaxCodes } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import type { EntrySide } from "@/lib/freee/wallet";

export type LlmMatcherCandidate = MatcherLlmSuggestion;

export type LlmMatcherSuggestionState =
  | { status: "idle" }
  | {
      status: "success";
      candidates: LlmMatcherCandidate[];
    }
  | { status: "error"; message: string };

function parseEntrySide(value: string): EntrySide | null {
  return value === "income" || value === "expense" ? value : null;
}

export async function requestLlmMatcherSuggestionAction(
  _prevState: LlmMatcherSuggestionState,
  formData: FormData,
): Promise<LlmMatcherSuggestionState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freee連携が切れています。再ログインしてください。" };
  }

  const companyId = String(formData.get("companyId") ?? "").trim();
  if (companyId !== auth.companyId) {
    return { status: "error", message: "事業所が一致しません。" };
  }

  const description = String(formData.get("description") ?? "").trim();
  const walletableName = String(formData.get("walletable") ?? "").trim();
  const entrySide = parseEntrySide(String(formData.get("entrySide") ?? ""));
  const amount = Number(formData.get("amount"));

  if (!description || !walletableName || !entrySide || !Number.isFinite(amount)) {
    return { status: "error", message: "明細情報が不足しています。" };
  }

  try {
    const [accountItems, taxCodes] = await Promise.all([
      getAccountItems(auth),
      getTaxCodes(auth),
    ]);

    const candidates = await suggestMatcherFieldsWithLlm(
      {
        description,
        amount,
        entrySide,
        walletableName,
      },
      accountItems,
      taxCodes,
    );

    return {
      status: "success",
      candidates,
    };
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
        error instanceof Error
          ? error.message
          : "AI提案を取得できませんでした。",
    };
  }
}
