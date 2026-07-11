"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  claimMatcherCreation,
  completeMatcherCreation,
  markMatcherCreationStarted,
  releaseMatcherCreation,
} from "@/lib/db/matcher-creation";
import { getDatabase } from "@/lib/db/turso";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  createUserMatcher,
  FreeeAccountingApiError,
  getUserMatchers,
  type CreateMatcherCondition,
  type EntrySide,
  type UserMatcher,
} from "@/lib/freee/wallet";

export interface MatcherActionState {
  status: "idle" | "success" | "error";
  message?: string;
  matcherId?: number;
}

function parseEntrySide(value: FormDataEntryValue | null): EntrySide | null {
  return value === "income" || value === "expense" ? value : null;
}

function parseCondition(
  value: FormDataEntryValue | null,
): CreateMatcherCondition | null {
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

export async function createMatcherAction(
  _previousState: MatcherActionState,
  formData: FormData,
): Promise<MatcherActionState> {
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

  const description = String(formData.get("description") ?? "").trim();
  const entrySide = parseEntrySide(formData.get("entrySide"));
  const condition = parseCondition(formData.get("condition"));
  const accountItemName = String(
    formData.get("accountItemName") ?? "",
  ).trim();
  const taxName = String(formData.get("taxName") ?? "").trim();
  const walletable = String(formData.get("walletable") ?? "").trim();
  const confirmed = formData.get("confirmed") === "on";

  if (
    !description ||
    !entrySide ||
    condition === null ||
    !accountItemName ||
    !taxName ||
    !confirmed
  ) {
    return {
      status: "error",
      message: "ルール内容と恒久適用の確認を入力してください。",
    };
  }

  try {
    const matchers = await getAllMatchers(auth);
    const duplicate = matchers.some(
      (matcher) =>
        matcher.entrySide === entrySide &&
        matcher.description === description &&
        matcher.condition === condition &&
        (matcher.walletable === undefined || matcher.walletable === walletable),
    );
    if (duplicate) {
      return {
        status: "error",
        message: "同じ条件の自動登録ルールがすでにあります。",
      };
    }

    const ruleKey = createHash("sha256")
      .update(JSON.stringify({ entrySide, description, condition, walletable }))
      .digest("hex");
    const db = getDatabase();
    const claim = await claimMatcherCreation(db, auth.companyId, ruleKey);
    if (!claim) {
      return {
        status: "error",
        message: "同じ条件の自動登録ルールは作成済み、または作成処理中です。",
      };
    }
    let externalCallStarted = false;
    let matcher;
    try {
      await markMatcherCreationStarted(db, claim);
      externalCallStarted = true;
      matcher = await createUserMatcher(auth, {
        entrySide,
        description,
        condition,
        priority: 1,
        accountItemName,
        taxName,
        ...(walletable ? { walletable } : {}),
      });
    } catch (error) {
      const definitiveClientError =
        error instanceof FreeeAccountingApiError &&
        error.status >= 400 &&
        error.status < 500;
      if (!externalCallStarted || definitiveClientError) {
        await releaseMatcherCreation(db, claim);
      }
      if (externalCallStarted && !definitiveClientError) {
        return {
          status: "error",
          message:
            "freee側のルール作成結果を確認できませんでした。二重作成を防ぐため再実行せず、freeeの自動登録ルール一覧を確認してください。",
        };
      }
      throw error;
    }
    try {
      await completeMatcherCreation(db, claim, matcher.id);
    } catch {
      return {
        status: "success",
        message:
          "自動登録ルールは作成されましたが、作成履歴を保存できませんでした。再実行せずfreeeで確認してください。",
        matcherId: matcher.id,
      };
    }
    revalidatePath("/wallet-txns");
    return {
      status: "success",
      message: "今後の同一明細に適用する自動登録ルールを作成しました。",
      matcherId: matcher.id,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "自動登録ルールを作成できませんでした。",
    };
  }
}
