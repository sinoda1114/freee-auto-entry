import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_MEMO_TAG_NAME } from "./memo-tag";
import {
  listRecentRegisteredExpenses,
  planDealPageOffsets,
  RECENT_EXPENSE_LIMIT,
  selectRecentDeals,
} from "./recent-expenses";

const auth = { accessToken: "token-abc", companyId: "11122591" };
const accountItems = [
  { id: 10, name: "消耗品費", defaultTaxCode: 136 },
  { id: 11, name: "旅費交通費", defaultTaxCode: 136 },
];

function deal(input: {
  id: number;
  amount?: number;
  description?: string | null;
  accountItemId?: number;
  tagIds?: number[];
}) {
  const detail: Record<string, unknown> = {
    account_item_id: input.accountItemId ?? 10,
    tag_ids: input.tagIds ?? [],
  };
  if (input.description) {
    detail.description = input.description;
  }
  return {
    id: input.id,
    issue_date: "2026-10-01",
    amount: input.amount ?? input.id * 100,
    details: [detail],
  };
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("planDealPageOffsets", () => {
  it("stays on the first page when every deal fits", () => {
    expect(
      planDealPageOffsets({
        firstPageIds: [1, 2, 3],
        totalCount: 3,
        pageSize: 100,
        maxPages: 8,
      }),
    ).toEqual([0]);
  });

  it("walks backward from the last page when ids ascend", () => {
    expect(
      planDealPageOffsets({
        firstPageIds: [1, 100],
        totalCount: 250,
        pageSize: 100,
        maxPages: 8,
      }),
    ).toEqual([200, 100, 0]);
  });

  it("walks forward when the first page is already newest-first", () => {
    expect(
      planDealPageOffsets({
        firstPageIds: [300, 201],
        totalCount: 300,
        pageSize: 100,
        maxPages: 2,
      }),
    ).toEqual([0, 100]);
  });
});

describe("selectRecentDeals", () => {
  it("keeps the five newest deals that carry the app tag", () => {
    const deals = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      id,
      issueDate: "2026-10-01",
      amount: id,
      description: `内容${id}`,
      accountItemId: 10,
      tagIds: id % 2 === 0 ? [7] : [],
    }));

    const picked = selectRecentDeals(deals, 7, RECENT_EXPENSE_LIMIT);

    expect(picked.map((deal) => deal.id)).toEqual([6, 4, 2]);
  });
});

describe("listRecentRegisteredExpenses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns no rows when this app has not created the memo tag", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tags: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns at most five tagged expenses, newest id first", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const deals = [1, 2, 3, 4, 5, 6].map((id) =>
      deal({
        id,
        description: id === 2 ? null : `内容${id}`,
        accountItemId: id === 4 ? 11 : 10,
        tagIds: id === 1 ? [] : [7],
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          tags: [
            { id: 1, name: "other" },
            { id: 7, name: APP_MEMO_TAG_NAME },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ deals, meta: { total_count: deals.length } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows.map((row) => row.id)).toEqual([6, 5, 4, 3, 2]);
    expect(rows[0]).toMatchObject({
      issueDate: "2026-10-01",
      amount: 600,
      description: "内容6",
      accountItemName: "消耗品費",
    });
    expect(rows.find((row) => row.id === 4)?.accountItemName).toBe("旅費交通費");
    expect(rows.find((row) => row.id === 2)?.description).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const dealsUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(dealsUrl).toContain("type=expense");
    expect(dealsUrl).toContain("company_id=11122591");
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(
      false,
    );
  });

  it("reads the newest pages when freee returns oldest deals first", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      deal({ id: index + 1, tagIds: [] }),
    );
    const middlePage = [
      deal({ id: 150, description: "中間", tagIds: [7] }),
      deal({ id: 160, description: "中間2", tagIds: [7] }),
    ];
    const lastPage = [
      deal({ id: 210, description: "新しい", tagIds: [7], accountItemId: 11 }),
      deal({ id: 220, description: "より新しい", tagIds: [] }),
      deal({ id: 230, description: "最新", tagIds: [7] }),
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ tags: [{ id: 7, name: APP_MEMO_TAG_NAME }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ deals: firstPage, meta: { total_count: 250 } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ deals: lastPage, meta: { total_count: 250 } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ deals: middlePage, meta: { total_count: 250 } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows.map((row) => row.id)).toEqual([230, 210, 160, 150]);
    expect(rows[1]?.accountItemName).toBe("旅費交通費");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("offset=200");
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("offset=100");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not list expenses that are missing the app memo tag", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const deals = [1, 2, 3].map((id) =>
      deal({ id, description: `内容${id}`, tagIds: [] }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ tags: [{ id: 7, name: APP_MEMO_TAG_NAME }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ deals, meta: { total_count: deals.length } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows).toEqual([]);
    const tagsUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(tagsUrl).toContain("limit=3000");
  });
});
