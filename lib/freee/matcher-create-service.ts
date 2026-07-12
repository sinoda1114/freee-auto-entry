import { createHash } from "node:crypto";
import {
  claimMatcherCreation,
  completeMatcherCreation,
  markMatcherCreationStarted,
  releaseMatcherCreation,
} from "@/lib/db/matcher-creation";
import type { Database } from "@/lib/db/types";
import {
  createUserMatcher,
  FreeeAccountingApiError,
  type CreateMatcherCondition,
  type CreateUserMatcherInput,
  type EntrySide,
  type UserMatcher,
} from "./wallet";

export interface MatcherCreateInput {
  entrySide: EntrySide;
  description: string;
  condition: CreateMatcherCondition;
  accountItemName: string;
  taxName: string;
  walletable?: string;
}

export type MatcherCreateResult =
  | { status: "success"; matcherId: number }
  | { status: "duplicate"; message: string }
  | { status: "locked"; message: string }
  | { status: "error"; message: string };

function ruleKeyFor(input: MatcherCreateInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        entrySide: input.entrySide,
        description: input.description,
        condition: input.condition,
        walletable: input.walletable ?? "",
      }),
    )
    .digest("hex");
}

function isDuplicateRule(
  input: MatcherCreateInput,
  matchers: UserMatcher[],
): boolean {
  return matchers.some(
    (matcher) =>
      matcher.entrySide === input.entrySide &&
      matcher.description === input.description &&
      matcher.condition === input.condition &&
      (matcher.walletable === undefined ||
        matcher.walletable === (input.walletable ?? "")),
  );
}

export async function createMatcherWithLock(
  auth: { accessToken: string; companyId: string },
  db: Database,
  input: MatcherCreateInput,
  existingMatchers: UserMatcher[],
): Promise<MatcherCreateResult> {
  if (isDuplicateRule(input, existingMatchers)) {
    return {
      status: "duplicate",
      message: "同じ条件の自動登録ルールがすでにあります。",
    };
  }

  const ruleKey = ruleKeyFor(input);
  const claim = await claimMatcherCreation(db, auth.companyId, ruleKey);
  if (!claim) {
    return {
      status: "locked",
      message: "同じ条件の自動登録ルールは作成済み、または作成処理中です。",
    };
  }

  const payload: CreateUserMatcherInput = {
    entrySide: input.entrySide,
    description: input.description,
    condition: input.condition,
    priority: 1,
    accountItemName: input.accountItemName,
    taxName: input.taxName,
    ...(input.walletable ? { walletable: input.walletable } : {}),
  };

  let externalCallStarted = false;
  let matcher: { id: number };
  try {
    await markMatcherCreationStarted(db, claim);
    externalCallStarted = true;
    matcher = await createUserMatcher(auth, payload);
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
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "自動登録ルールを作成できませんでした。",
    };
  }

  try {
    await completeMatcherCreation(db, claim, matcher.id);
  } catch {
    return {
      status: "success",
      matcherId: matcher.id,
    };
  }

  return { status: "success", matcherId: matcher.id };
}
