import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_MEMO_TAG_NAME } from "./memo-tag";
import {
  listRecentRegisteredExpenses,
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
  issueDate?: string;
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
    issue_date: input.issueDate ?? "2026-10-01",
    amount: input.amount ?? input.id * 100,
    details: [detail],
  };
}

function dealOffset(url: unknown): number {
  return Number(new URL(String(url)).searchParams.get("offset"));
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

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

  it("reads every issue_date page and ranks tagged deals by id", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      deal({ id: index + 1, tagIds: [] }),
    );
    const middlePage = [
      deal({ id: 150, description: "中間", tagIds: [7] }),
      deal({ id: 160, description: "中間2", tagIds: [7] }),
      ...Array.from({ length: 98 }, (_, index) =>
        deal({ id: 10000 + index, tagIds: [] }),
      ),
    ];
    const lastPage = [
      deal({ id: 210, description: "新しい", tagIds: [7], accountItemId: 11 }),
      deal({ id: 220, description: "より新しい", tagIds: [] }),
      deal({ id: 230, description: "最新", tagIds: [7] }),
    ];
    const pages = new Map<number, unknown[]>([
      [0, firstPage],
      [100, middlePage],
      [200, lastPage],
    ]);
    const fetchMock = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes("/tags")) {
        return jsonResponse({ tags: [{ id: 7, name: APP_MEMO_TAG_NAME }] });
      }
      const offset = dealOffset(url);
      return jsonResponse({
        deals: pages.get(offset) ?? [],
        meta: { total_count: 250 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows.map((row) => row.id)).toEqual([230, 210, 160, 150]);
    expect(rows[1]?.accountItemName).toBe("旅費交通費");
    const dealCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((href) => href.includes("/deals"));
    expect(dealCalls.map(dealOffset)).toEqual([0, 100, 200]);
  });

  it("keeps a backdated registration on the first page when later pages already have five tagged deals", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const firstPage = [
      ...Array.from({ length: 99 }, (_, index) =>
        deal({ id: index + 1, tagIds: [] }),
      ),
      deal({
        id: 9000,
        issueDate: "2020-01-01",
        description: "遡及の備品",
        tagIds: [7],
      }),
    ];
    const lastPage = [200, 201, 202, 203, 204].map((id) =>
      deal({
        id,
        issueDate: "2026-10-09",
        description: `新しい${id}`,
        tagIds: [7],
      }),
    );
    const fetchMock = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes("/tags")) {
        return jsonResponse({ tags: [{ id: 7, name: APP_MEMO_TAG_NAME }] });
      }
      const offset = dealOffset(url);
      if (offset === 0) {
        return jsonResponse({
          deals: firstPage,
          meta: { total_count: 250 },
        });
      }
      if (offset === 200) {
        return jsonResponse({
          deals: lastPage,
          meta: { total_count: 250 },
        });
      }
      return jsonResponse({
        deals: Array.from({ length: 100 }, (_, index) =>
          deal({ id: 1000 + offset + index, tagIds: [] }),
        ),
        meta: { total_count: 250 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows.map((row) => row.id)).toEqual([9000, 204, 203, 202, 201]);
    expect(rows[0]).toMatchObject({
      issueDate: "2020-01-01",
      description: "遡及の備品",
    });
    const dealCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((href) => href.includes("/deals"));
    expect(dealCalls.map(dealOffset)).toEqual([0, 100, 200]);
  });

  it("still reads past the first pages when page 0 ids look newest-first", async () => {
    vi.stubEnv("E2E_TEST_MODE", "");
    const totalCount = 1100;
    const fetchMock = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes("/tags")) {
        return jsonResponse({ tags: [{ id: 7, name: APP_MEMO_TAG_NAME }] });
      }
      const offset = dealOffset(url);
      if (offset === 0) {
        return jsonResponse({
          deals: [
            deal({
              id: 500,
              issueDate: "2026-10-09",
              description: "先頭",
              tagIds: [7],
            }),
            ...Array.from({ length: 98 }, (_, index) =>
              deal({ id: 400 - index, tagIds: [] }),
            ),
            deal({ id: 100, tagIds: [] }),
          ],
          meta: { total_count: totalCount },
        });
      }
      if (offset === 1000) {
        return jsonResponse({
          deals: [
            deal({
              id: 99999,
              issueDate: "2020-01-01",
              description: "窓の外だった遡及",
              tagIds: [7],
            }),
          ],
          meta: { total_count: totalCount },
        });
      }
      return jsonResponse({
        deals: Array.from({ length: 100 }, (_, index) =>
          deal({ id: offset + index + 1, tagIds: [] }),
        ),
        meta: { total_count: totalCount },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listRecentRegisteredExpenses(auth, accountItems);

    expect(rows.map((row) => row.id)).toEqual([99999, 500]);
    expect(rows[0]).toMatchObject({
      issueDate: "2020-01-01",
      description: "窓の外だった遡及",
    });
    const offsets = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((href) => href.includes("/deals"))
      .map(dealOffset);
    expect(offsets[0]).toBe(0);
    expect(offsets).toContain(1000);
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
