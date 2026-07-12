"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/lib/db/turso";
import { createMatcherWithLock } from "@/lib/freee/matcher-create-service";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
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
      message: "自動登録ルールの内容と確認にチェックを入れてください。",
    };
  }

  try {
    const matchers = await getAllMatchers(auth);
    const result = await createMatcherWithLock(
      auth,
      getDatabase(),
      {
        entrySide,
        description,
        condition,
        accountItemName,
        taxName,
        ...(walletable ? { walletable } : {}),
      },
      matchers,
    );

    if (result.status === "duplicate" || result.status === "locked") {
      return { status: "error", message: result.message };
    }
    if (result.status === "error") {
      return { status: "error", message: result.message };
    }

    revalidatePath("/wallet-txns");
    return {
      status: "success",
      message: "今後の同一明細に適用する自動登録ルールを作成しました。",
      matcherId: result.matcherId,
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
