"use server";

import { createDeal } from "@/lib/freee/accounting";
import {
  formatDealCreateError,
  getCompanyFiscalYears,
  isDateInRegistrableRange,
  resolveRegistrableDateRange,
} from "@/lib/freee/company";
import { listExistingSuicaFingerprints } from "@/lib/freee/suica-existing";
import { getAppMemoTagId } from "@/lib/freee/memo-tag";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import {
  fingerprintFromItem,
  formatSuicaExpenseDescription,
  partitionByExistingFingerprints,
} from "@/lib/suica/dedupe";
import {
  decodeSuicaHandoffPayload,
  type SuicaTransitItem,
} from "@/lib/suica/history";
import {
  SUICA_EXPENSE_BATCH_LIMIT,
  type SuicaDuplicateCheckResult,
  type SuicaExpenseFormState,
} from "./constants";

function dateBounds(items: SuicaTransitItem[]): {
  startDate: string;
  endDate: string;
} | null {
  if (items.length === 0) return null;
  let startDate = items[0]!.date;
  let endDate = items[0]!.date;
  for (const item of items) {
    if (item.date < startDate) startDate = item.date;
    if (item.date > endDate) endDate = item.date;
  }
  return { startDate, endDate };
}

export async function checkSuicaDuplicatesAction(
  encodedItems: string,
): Promise<SuicaDuplicateCheckResult> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return {
      status: "error",
      message: "freeeとの連携が切れています。再度ログインしてください。",
      duplicateIndexes: [],
    };
  }

  let items: SuicaTransitItem[];
  try {
    items = decodeSuicaHandoffPayload(encodedItems).items;
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "明細の読み取りに失敗しました。",
      duplicateIndexes: [],
    };
  }

  const bounds = dateBounds(items);
  if (!bounds) {
    return { status: "success", duplicateIndexes: [] };
  }

  try {
    const existing = await listExistingSuicaFingerprints(
      auth,
      bounds.startDate,
      bounds.endDate,
    );
    const { duplicateIndexes } = partitionByExistingFingerprints(
      items,
      existing,
    );
    return { status: "success", duplicateIndexes };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "既存取引の確認に失敗しました。",
      duplicateIndexes: [],
    };
  }
}

export async function createSuicaExpensesAction(
  _prev: SuicaExpenseFormState,
  formData: FormData,
): Promise<SuicaExpenseFormState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return {
      status: "error",
      message: "freeeとの連携が切れています。再度ログインしてください。",
    };
  }

  const encodedItems = String(formData.get("encodedItems") ?? "");
  const accountItemId = Number(formData.get("accountItemId"));
  const taxCode = Number(formData.get("taxCode"));
  const selectedRaw = String(formData.get("selectedIndexes") ?? "");

  if (!encodedItems || !accountItemId || !taxCode) {
    return {
      status: "error",
      message: "勘定科目・税区分と明細を指定してください。",
    };
  }

  let items: SuicaTransitItem[];
  try {
    items = decodeSuicaHandoffPayload(encodedItems).items;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "明細の読み取りに失敗しました。";
    return { status: "error", message };
  }

  const indexes = selectedRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length);

  const selected =
    indexes.length > 0 ? indexes.map((i) => items[i]!).filter(Boolean) : items;

  if (selected.length === 0) {
    return { status: "error", message: "登録する明細を選択してください。" };
  }

  if (selected.length > SUICA_EXPENSE_BATCH_LIMIT) {
    return {
      status: "error",
      message: `1回あたり最大 ${SUICA_EXPENSE_BATCH_LIMIT} 件までです（今回 ${selected.length} 件）。画面側で分割して再送してください。`,
    };
  }

  let dateRange = null;
  try {
    const fiscalYears = await getCompanyFiscalYears(auth);
    dateRange = resolveRegistrableDateRange(fiscalYears);
  } catch {
    // 年度取得失敗時は freee 側バリデーションに委ねる
  }

  const outOfRange = selected.filter(
    (item) => !isDateInRegistrableRange(item.date, dateRange),
  );
  if (outOfRange.length > 0 && dateRange) {
    return {
      status: "error",
      message: `会計年度（${dateRange.startDate}〜${dateRange.endDate}）の外の明細が ${outOfRange.length} 件あります。対象期間内だけ選んでください。`,
    };
  }

  const bounds = dateBounds(selected);
  let existing = new Set<string>();
  if (bounds) {
    try {
      existing = await listExistingSuicaFingerprints(
        auth,
        bounds.startDate,
        bounds.endDate,
      );
    } catch {
      // 照合失敗時は登録を止めず、作成時の二重押しだけはバッチ内で防ぐ
    }
  }

  const { fresh, duplicates } = partitionByExistingFingerprints(
    selected,
    existing,
  );

  // 同一リクエスト内の二重も排除
  const seenInBatch = new Set<string>();
  const toCreate: SuicaTransitItem[] = [];
  let skippedInBatch = 0;
  for (const item of fresh) {
    const fp = fingerprintFromItem(item);
    if (seenInBatch.has(fp)) {
      skippedInBatch += 1;
      continue;
    }
    seenInBatch.add(fp);
    toCreate.push(item);
  }
  const totalSkipped = duplicates.length + skippedInBatch;

  if (toCreate.length === 0) {
    return {
      status: "success",
      dealIds: [],
      registeredCount: 0,
      skippedDuplicateCount: totalSkipped,
      message: `新規登録はありません（重複 ${totalSkipped} 件をスキップ）。`,
    };
  }

  const dealIds: number[] = [];
  try {
    const memoTagId = await getAppMemoTagId(auth);
    for (const item of toCreate) {
      const deal = await createDeal(auth, {
        issueDate: item.date,
        accountItemId,
        taxCode,
        amount: item.amount,
        description: formatSuicaExpenseDescription(item),
        memoTagIds: memoTagId ? [memoTagId] : undefined,
      });
      dealIds.push(deal.id);
      existing.add(fingerprintFromItem(item));
    }
    const skipNote =
      totalSkipped > 0 ? `（重複 ${totalSkipped} 件はスキップ）` : "";
    return {
      status: "success",
      dealIds,
      registeredCount: dealIds.length,
      skippedDuplicateCount: totalSkipped,
      message: `${dealIds.length}件の経費を登録しました。${skipNote}`,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "不明なエラーです。";
    const message = formatDealCreateError(raw);
    if (dealIds.length > 0) {
      return {
        status: "error",
        dealIds,
        registeredCount: dealIds.length,
        skippedDuplicateCount: totalSkipped,
        message: `${dealIds.length}件まで登録したあと失敗しました: ${message}`,
      };
    }
    return { status: "error", message, skippedDuplicateCount: totalSkipped };
  }
}
