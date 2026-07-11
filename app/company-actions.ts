"use server";

import { revalidatePath } from "next/cache";
import { switchActiveCompany } from "@/lib/freee/session-client";

export interface SwitchCompanyResult {
  status: "switched" | "not-connected" | "refresh-failed";
}

/**
 * トップページのドロップダウンから呼ばれるServer Action。
 * 認可済みの事業所であればセッションのアクティブ事業所を切り替える。
 * 未認可の事業所の場合は呼び出し側(UI)でOAuth認可フローへの導線を出す。
 */
export async function switchCompanyAction(
  companyId: string,
): Promise<SwitchCompanyResult> {
  const result = await switchActiveCompany(companyId);

  if (!result.ok) {
    return { status: result.reason };
  }

  revalidatePath("/", "layout");
  return { status: "switched" };
}
