import { chromium } from "playwright";
import {
  bootstrapE2ESession,
  registerFreeeApiMocks,
} from "../e2e/helpers/freee-api-mocks.mjs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";

/** @param {boolean} condition @param {string} name */
function assert(condition, name) {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  console.log(`PASS: ${name}`);
}

/**
 * @param {import('playwright').Locator} locator
 * @param {string} name
 * @param {number} [timeout]
 */
async function assertVisible(locator, name, timeout = 15_000) {
  await locator.waitFor({ state: "visible", timeout });
  console.log(`PASS: ${name}`);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await registerFreeeApiMocks(page);
  await bootstrapE2ESession(page);

  await page.goto("/wallet-txns/rules");
  await assertVisible(
    page.getByRole("heading", { name: "自動登録ルール" }),
    "rules page heading",
  );
  await assertVisible(page.getByText("Microsoft 365"), "rules list item");
  await page.getByRole("button", { name: "推測" }).click();
  await assertVisible(page.getByText("Amazon"), "inference filter shows Amazon");
  assert(
    (await page.getByText("Microsoft 365").count()) === 0,
    "auto rules hidden in inference filter",
  );

  await page.goto("/wallet-txns");
  await assertVisible(
    page.getByRole("link", { name: "自動登録ルール" }),
    "wallet subnav",
  );
  await assertVisible(page.getByText("ルール一致").first(), "matched chip");
  await assertVisible(
    page.getByRole("button", { name: /^要手動設定/ }),
    "manual filter button",
  );

  await page.getByRole("button", { name: /^ルール一致/ }).click();
  await assertVisible(
    page.getByRole("heading", { name: "Microsoft 365" }),
    "matched filter",
  );
  assert(
    (await page.getByRole("heading", { name: "DAZN サブスク" }).count()) === 0,
    "manual hidden in matched filter",
  );

  await page.getByRole("button", { name: /^要手動設定/ }).click();
  await page.getByRole("button", { name: /表示中を全選択/ }).click();
  await page.getByRole("button", { name: "一括プレビュー" }).click();
  await assertVisible(
    page.getByRole("dialog").getByText("一括プレビュー").first(),
    "batch preview modal",
  );

  await page.getByRole("button", { name: /AIでルールを提案/ }).click();
  await assertVisible(page.getByText("AI提案ルール"), "ai rule proposals");
  await assertVisible(
    page.getByText("サブスクリプション料金"),
    "ai reasoning",
  );

  await page.getByRole("checkbox", { name: /確認しました/ }).check();
  await page.getByRole("button", { name: /ルールを一括作成/ }).click();
  await assertVisible(
    page.getByText(/件の自動登録ルールを作成しました/).first(),
    "batch rule creation success",
  );

  await page.goto("/wallet-txns");
  await page.getByRole("button", { name: /^ルール一致/ }).click();
  await page.getByRole("button", { name: /表示中を全選択/ }).click();
  await page.getByRole("button", { name: "一括プレビュー" }).click();
  await assertVisible(
    page.getByRole("dialog").getByText("ルール一致（freeeで確定）"),
    "matched preview section",
  );
  await assertVisible(
    page.getByRole("dialog").getByText("freeeで確定 ↗"),
    "freee confirm link",
  );

  await browser.close();
  console.log("\nAll headless E2E checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
