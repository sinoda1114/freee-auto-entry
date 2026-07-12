/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').Route} Route */

export const E2E_COMPANY_ID = "11122591";

const accountItems = [
  { id: 1, name: "通信費", available: true, default_tax_code: 136 },
  { id: 2, name: "消耗品費", available: true, default_tax_code: 136 },
  { id: 3, name: "売上高", available: true, default_tax_code: 129 },
];

const taxes = [
  { code: 136, name_ja: "課対仕入10%", available: true },
  { code: 129, name_ja: "課税売上10%", available: true },
];

const walletables = [
  { id: 10, name: "メイン口座" },
  { id: 20, name: "法人カード" },
];

export const walletTxns = [
  {
    id: 101,
    company_id: Number(E2E_COMPANY_ID),
    date: "2026-07-01",
    amount: -260,
    due_amount: -260,
    entry_side: "expense",
    walletable_type: "credit_card",
    walletable_id: 20,
    description: "Microsoft 365",
    status: 1,
    rule_matched: false,
  },
  {
    id: 102,
    company_id: Number(E2E_COMPANY_ID),
    date: "2026-07-02",
    amount: -980,
    due_amount: -980,
    entry_side: "expense",
    walletable_type: "credit_card",
    walletable_id: 20,
    description: "DAZN サブスク",
    status: 1,
    rule_matched: false,
  },
  {
    id: 103,
    company_id: Number(E2E_COMPANY_ID),
    date: "2026-07-03",
    amount: 50000,
    due_amount: 50000,
    entry_side: "income",
    walletable_type: "bank_account",
    walletable_id: 10,
    description: "振込 カ）ABC",
    status: 1,
    rule_matched: false,
  },
];

export const userMatchers = [
  {
    id: 9,
    entry_side_str: "expense",
    description: "Microsoft 365",
    condition: 3,
    priority: 1,
    act: 1,
    active: true,
    account_item_name: "通信費",
    tax_name: "課対仕入10%",
  },
  {
    id: 10,
    entry_side_str: "expense",
    description: "Amazon",
    condition: 0,
    priority: 2,
    act: 0,
    active: true,
    account_item_name: "消耗品費",
    tax_name: "課対仕入10%",
  },
  {
    id: 11,
    entry_side_str: "income",
    description: "振込 カ）ABC",
    condition: 3,
    priority: 1,
    act: 1,
    active: true,
    account_item_name: "売上高",
    tax_name: "課税売上10%",
  },
];

let createdMatcherId = 1000;

/** @param {Route} route @param {unknown} body @param {number} [status] */
function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** @param {Page} page */
export async function registerFreeeApiMocks(page) {
  await page.route("https://api.freee.co.jp/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/wallet_txns") && route.request().method() === "GET") {
      return json(route, { wallet_txns: walletTxns });
    }

    if (path.endsWith("/user_matchers") && route.request().method() === "GET") {
      const act = url.searchParams.get("act");
      const data = act
        ? userMatchers.filter((matcher) => matcher.act === Number(act))
        : userMatchers;
      return json(route, { data });
    }

    if (path.endsWith("/user_matchers") && route.request().method() === "POST") {
      createdMatcherId += 1;
      return json(route, { id: createdMatcherId }, 201);
    }

    if (path.endsWith("/account_items")) {
      return json(route, { account_items: accountItems });
    }

    if (path.includes("/taxes/companies/")) {
      return json(route, { taxes });
    }

    if (path.endsWith("/walletables")) {
      return json(route, { walletables });
    }

    return json(route, { error: `Unmocked freee path: ${path}` }, 404);
  });

  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      return json(route, {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    rules: [
                      {
                        description: "DAZN",
                        condition: 0,
                        accountItemName: "通信費",
                        taxName: "課対仕入10%",
                        entrySide: "expense",
                        reasoning: "サブスクリプション料金として通信費が妥当です。",
                        transactionIds: [102],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      });
    },
  );
}

/** @param {Page} page */
export async function bootstrapE2ESession(page) {
  const response = await page.request.post("/api/e2e/bootstrap");
  if (!response.ok()) {
    throw new Error(`E2E bootstrap failed: ${response.status()}`);
  }
}
