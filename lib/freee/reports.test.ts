import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatTrialReportForPrompt,
  getGeneralLedgers,
  getTrialBs,
  getTrialPl,
  summarizeTrialBalances,
  type TrialBalanceLine,
} from "./reports";

const auth = { accessToken: "token-1", companyId: "11122591" };

describe("summarizeTrialBalances", () => {
  it("drops zero rows and keeps top balances", () => {
    const balances: TrialBalanceLine[] = [
      {
        accountItemName: "売上高",
        hierarchyLevel: 1,
        parentAccountCategoryName: null,
        closingBalance: 1000,
        compositionRatio: 100,
      },
      {
        accountItemName: "ゼロ",
        hierarchyLevel: 2,
        parentAccountCategoryName: "売上高",
        closingBalance: 0,
        compositionRatio: 0,
      },
      {
        accountItemName: "小科目",
        hierarchyLevel: 3,
        parentAccountCategoryName: "売上高",
        closingBalance: 50,
        compositionRatio: 5,
      },
    ];

    const summary = summarizeTrialBalances(balances, 10);
    expect(summary.lines.some((line) => line.includes("売上高"))).toBe(true);
    expect(summary.lines.some((line) => line.includes("ゼロ"))).toBe(false);
    // hierarchy > 2 は浅い行がある場合は除外される
    expect(summary.lines.some((line) => line.includes("小科目"))).toBe(false);
  });
});

describe("getTrialPl / getTrialBs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches trial_pl with group display and date range", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trial_pl: {
          company_id: 11122591,
          start_date: "2025-01-01",
          end_date: "2025-12-31",
          balances: [
            {
              account_item_name: "売上高",
              hierarchy_level: 1,
              closing_balance: 100,
              composition_ratio: 100,
            },
          ],
        },
        up_to_date: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await getTrialPl(auth, {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/reports/trial_pl?");
    expect(url).toContain("company_id=11122591");
    expect(url).toContain("account_item_display_type=group");
    expect(url).toContain("start_date=2025-01-01");
    expect(url).toContain("end_date=2025-12-31");
    expect(report.kind).toBe("pl");
    expect(report.upToDate).toBe(true);
    expect(report.balances[0]?.accountItemName).toBe("売上高");
  });

  it("fetches trial_bs with fiscal_year when dates are omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trial_bs: {
          company_id: 11122591,
          fiscal_year: 2025,
          balances: [
            {
              account_item_name: "現金",
              hierarchy_level: 2,
              parent_account_category_name: "資産の部",
              closing_balance: 300,
            },
          ],
        },
        up_to_date: false,
        up_to_date_reasons: [
          { code: "depreciation_creating", message: "償却作成中" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await getTrialBs(auth, { fiscalYear: 2025 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/reports/trial_bs?");
    expect(url).toContain("fiscal_year=2025");
    expect(report.upToDate).toBe(false);
    expect(report.upToDateReasons).toEqual(["償却作成中"]);
  });

  it("formats a trial report for the LLM prompt", () => {
    const text = formatTrialReportForPrompt("損益計算書", {
      kind: "pl",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      fiscalYear: 2025,
      upToDate: true,
      upToDateReasons: [],
      balances: [
        {
          accountItemName: "売上高",
          hierarchyLevel: 1,
          parentAccountCategoryName: null,
          closingBalance: 1000,
          compositionRatio: 100,
        },
      ],
    });
    expect(text).toContain("損益計算書");
    expect(text).toContain("売上高");
    expect(text).toContain("集計は最新");
  });
});

describe("getGeneralLedgers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches general ledgers filtered by account name", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        general_ledgers: [
          {
            account_item_id: 10,
            account_item_name: "旅費交通費",
            total_amount: 5000,
            final_balance: 5000,
            debit_amount: 5000,
            credit_amount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ledgers = await getGeneralLedgers(auth, {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      accountItemName: "旅費交通費",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/reports/general_ledgers?");
    expect(url).toContain("account_item_name=");
    expect(ledgers[0]?.accountItemName).toBe("旅費交通費");
  });
});
