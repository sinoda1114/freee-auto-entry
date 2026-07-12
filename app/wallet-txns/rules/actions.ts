"use server";

import { revalidatePath } from "next/cache";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  getUserMatcherById,
  updateUserMatcher,
  type UserMatcher,
} from "@/lib/freee/wallet";

export interface MatcherUpdateState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function toggleMatcherActiveAction(
  matcherId: number,
  active: boolean,
): Promise<MatcherUpdateState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeへ再連携してください。" };
  }
  try {
    const matcher = await getUserMatcherById(auth, matcherId);
    await updateUserMatcher(auth, matcher, { active });
    revalidatePath("/wallet-txns/rules");
    return {
      status: "success",
      message: active ? "ルールを有効化しました。" : "ルールを無効化しました。",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "ルールの状態を変更できませんでした。",
    };
  }
}

export async function updateMatcherFieldsAction(
  _prev: MatcherUpdateState,
  formData: FormData,
): Promise<MatcherUpdateState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return { status: "error", message: "freeeへ再連携してください。" };
  }

  const matcherIdRaw = formData.get("matcherId");
  const matcherId = Number(matcherIdRaw);
  if (!matcherIdRaw || !Number.isInteger(matcherId) || matcherId <= 0) {
    return { status: "error", message: "ルールIDが不正です。" };
  }

  const description = String(formData.get("description") ?? "").trim();
  const accountItemName = String(formData.get("accountItemName") ?? "").trim();
  const taxName = String(formData.get("taxName") ?? "").trim();

  if (!description || !accountItemName || !taxName) {
    return { status: "error", message: "摘要・勘定科目・税区分は必須です。" };
  }

  try {
    const matcher: UserMatcher = await getUserMatcherById(auth, matcherId);
    await updateUserMatcher(auth, matcher, {
      description,
      accountItemName,
      taxName,
    });
    revalidatePath("/wallet-txns/rules");
    return { status: "success", message: "ルールを更新しました。" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "ルールを更新できませんでした。",
    };
  }
}
