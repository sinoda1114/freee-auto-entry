import type { AccountItem, FreeeAuth } from "@/lib/freee/accounting";
import { findAppMemoTagId } from "@/lib/freee/memo-tag";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";
const DEAL_PAGE_SIZE = 100;
const MAX_PAGES = 8;

export const RECENT_EXPENSE_LIMIT = 5;

export interface RecentExpense {
  id: number;
  issueDate: string;
  amount: number;
  description: string | null;
  accountItemName: string | null;
}

interface ListedDeal {
  id: number;
  issueDate: string;
  amount: number;
  description: string | null;
  accountItemId: number | null;
  tagIds: number[];
}

interface DealPage {
  deals: ListedDeal[];
  totalCount: number;
}

const e2eRecentExpenses: RecentExpense[] = [
  {
    id: 503,
    issueDate: "2026-10-08",
    amount: 1280,
    description: "文房具",
    accountItemName: "消耗品費",
  },
  {
    id: 502,
    issueDate: "2026-10-02",
    amount: 540,
    description: "電車",
    accountItemName: "旅費交通費",
  },
  {
    id: 501,
    issueDate: "2026-09-28",
    amount: 3200,
    description: "通信費 10月",
    accountItemName: "通信費",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * GET /api/1/deals に並び順もアプリ絞り込みもない。
 * 請求一覧と同じく古い順とみて末尾ページから読み、先頭ページの id が降順なら新しい順として先頭から読む。
 */
export function planDealPageOffsets(input: {
  firstPageIds: number[];
  totalCount: number;
  pageSize: number;
  maxPages: number;
}): number[] {
  const { firstPageIds, totalCount, pageSize, maxPages } = input;
  if (totalCount <= pageSize) {
    return [0];
  }

  const newestFirst =
    firstPageIds.length >= 2 &&
    firstPageIds[0]! > firstPageIds[firstPageIds.length - 1]!;
  const start = newestFirst
    ? 0
    : Math.floor((totalCount - 1) / pageSize) * pageSize;
  const step = newestFirst ? pageSize : -pageSize;
  const offsets: number[] = [];

  for (let index = 0; index < maxPages; index += 1) {
    const offset = start + index * step;
    if (offset < 0 || offset >= totalCount) {
      break;
    }
    offsets.push(offset);
  }

  return offsets.length > 0 ? offsets : [0];
}

export function selectRecentDeals(
  deals: ListedDeal[],
  tagId: number,
  limit: number,
): ListedDeal[] {
  return deals
    .filter((deal) => deal.tagIds.includes(tagId))
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

function parseDeal(value: unknown): ListedDeal | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "number" ||
    typeof value.issue_date !== "string" ||
    typeof value.amount !== "number"
  ) {
    return null;
  }

  const details = Array.isArray(value.details) ? value.details : [];
  const tagIds: number[] = [];
  let description: string | null = null;
  let accountItemId: number | null = null;

  for (const detail of details) {
    if (!isRecord(detail)) {
      continue;
    }
    if (
      description === null &&
      typeof detail.description === "string" &&
      detail.description.trim()
    ) {
      description = detail.description.trim();
    }
    if (accountItemId === null && typeof detail.account_item_id === "number") {
      accountItemId = detail.account_item_id;
    }
    if (!Array.isArray(detail.tag_ids)) {
      continue;
    }
    for (const tagId of detail.tag_ids) {
      if (typeof tagId === "number") {
        tagIds.push(tagId);
      }
    }
  }

  return {
    id: value.id,
    issueDate: value.issue_date,
    amount: value.amount,
    description,
    accountItemId,
    tagIds,
  };
}

function readTotalCount(
  data: Record<string, unknown>,
  dealsLength: number,
): number {
  if (isRecord(data.meta) && typeof data.meta.total_count === "number") {
    return data.meta.total_count;
  }
  return dealsLength;
}

async function fetchDealPage(auth: FreeeAuth, offset: number): Promise<DealPage> {
  const params = new URLSearchParams({
    company_id: auth.companyId,
    type: "expense",
    limit: String(DEAL_PAGE_SIZE),
    offset: String(offset),
  });
  const response = await fetch(`${ACCOUNTING_API_BASE}/deals?${params}`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`freee accounting API request failed: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.deals)) {
    throw new Error("freee deals response is invalid");
  }

  const deals = data.deals.flatMap((row) => {
    const deal = parseDeal(row);
    return deal ? [deal] : [];
  });

  return {
    deals,
    totalCount: readTotalCount(data, deals.length),
  };
}

function toRecentExpenses(
  deals: ListedDeal[],
  accountItems: AccountItem[],
): RecentExpense[] {
  const names = new Map(accountItems.map((item) => [item.id, item.name]));
  return deals.map((deal) => ({
    id: deal.id,
    issueDate: deal.issueDate,
    amount: deal.amount,
    description: deal.description,
    accountItemName:
      deal.accountItemId === null
        ? null
        : (names.get(deal.accountItemId) ?? null),
  }));
}

export async function listRecentRegisteredExpenses(
  auth: FreeeAuth,
  accountItems: AccountItem[],
): Promise<RecentExpense[]> {
  if (isE2ETestMode()) {
    return e2eRecentExpenses;
  }

  const tagId = await findAppMemoTagId(auth);
  if (tagId === null) {
    return [];
  }

  const firstPage = await fetchDealPage(auth, 0);
  const offsets = planDealPageOffsets({
    firstPageIds: firstPage.deals.map((deal) => deal.id),
    totalCount: firstPage.totalCount,
    pageSize: DEAL_PAGE_SIZE,
    maxPages: MAX_PAGES,
  });

  const collected: ListedDeal[] = [];
  for (const offset of offsets) {
    const page = offset === 0 ? firstPage : await fetchDealPage(auth, offset);
    collected.push(...page.deals);
    if (
      selectRecentDeals(collected, tagId, RECENT_EXPENSE_LIMIT).length >=
      RECENT_EXPENSE_LIMIT
    ) {
      break;
    }
  }

  return toRecentExpenses(
    selectRecentDeals(collected, tagId, RECENT_EXPENSE_LIMIT),
    accountItems,
  );
}
