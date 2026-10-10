import { isE2ETestMode } from "@/lib/e2e/fixtures";
import {
  RECENT_EXPENSE_LIMIT,
  type RecentExpenseRow,
} from "@/lib/expenses/recent-expense-list";
import type { AccountItem, FreeeAuth } from "@/lib/freee/accounting";
import { findAppMemoTagId } from "@/lib/freee/memo-tag";

export { RECENT_EXPENSE_LIMIT };
export type { RecentExpenseRow as RecentExpense } from "@/lib/expenses/recent-expense-list";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";
const DEAL_PAGE_SIZE = 100;
/** Suica の取引走査と同じ上限。これを超える取引は直近 5 件の対象外にする。 */
const MAX_PAGES = 30;

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

const e2eRecentExpenses: RecentExpenseRow[] = [
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
): RecentExpenseRow[] {
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
): Promise<RecentExpenseRow[]> {
  if (isE2ETestMode()) {
    return e2eRecentExpenses;
  }

  const tagId = await findAppMemoTagId(auth);
  if (tagId === null) {
    return [];
  }

  // GET /api/1/deals は id 順ではない（issue_date 順）。
  // 先頭ページの id で走査方向を決めると、発生日が古い新規登録が窓の外に残る。
  const collected: ListedDeal[] = [];
  let totalCount = Number.POSITIVE_INFINITY;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * DEAL_PAGE_SIZE;
    if (offset >= totalCount) {
      break;
    }
    const result = await fetchDealPage(auth, offset);
    totalCount = result.totalCount;
    collected.push(...result.deals);
    if (result.deals.length < DEAL_PAGE_SIZE) {
      break;
    }
  }

  return toRecentExpenses(
    selectRecentDeals(collected, tagId, RECENT_EXPENSE_LIMIT),
    accountItems,
  );
}
