import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUserMatcher,
  getUserMatchers,
  getWalletTransactions,
  matchUserMatcher,
} from "./wallet";

const auth = { accessToken: "token-1", companyId: "11122591" };

describe("wallet transactions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a 100-row page for the active company", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wallet_txns: [
          {
            id: 1,
            company_id: 11122591,
            date: "2026-07-10",
            amount: -260,
            due_amount: -260,
            entry_side: "expense",
            walletable_type: "credit_card",
            walletable_id: 20,
            description: "Microsoft 365",
            status: 1,
            rule_matched: false,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWalletTransactions(auth, { offset: 100, limit: 100 });

    expect(result[0]?.description).toBe("Microsoft 365");
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "company_id=11122591&offset=100&limit=100",
    );
  });

  it("matches active exact rules by description and entry side", () => {
    const transaction = {
      id: 1,
      companyId: "11122591",
      date: "2026-07-10",
      amount: -260,
      dueAmount: -260,
      entrySide: "expense" as const,
      walletableType: "credit_card" as const,
      walletableId: 20,
      description: "Microsoft 365",
      status: 1,
      ruleMatched: false,
    };
    const matcher = {
      id: 9,
      entrySide: "expense" as const,
      description: "Microsoft 365",
      condition: 3 as const,
      priority: 1,
      act: 1,
      accountItemName: "通信費",
      taxName: "課対仕入10%",
      active: true,
    };

    expect(matchUserMatcher(transaction, [matcher])).toEqual(matcher);
  });

  it("creates an automatic registration rule with act 1", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 9 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createUserMatcher(auth, {
      entrySide: "expense",
      description: "Microsoft 365",
      condition: 3,
      priority: 1,
      accountItemName: "通信費",
      taxName: "課対仕入10%",
      walletable: "Waalsforceカード",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      act: 1,
      active: true,
      description: "Microsoft 365",
      account_item_name: "通信費",
    });
  });

  it("loads only active automatic rules", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getUserMatchers(auth, { offset: 0, limit: 100, act: 1 });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("active=active&act=1");
  });
});
