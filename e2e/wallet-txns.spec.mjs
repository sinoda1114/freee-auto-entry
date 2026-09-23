import { expect, test } from "@playwright/test";
import {
  bootstrapE2ESession,
  registerFreeeApiMocks,
} from "./helpers/freee-api-mocks.mjs";

test.describe("未処理明細・自動登録ルール E2E", () => {
  test.beforeEach(async ({ page }) => {
    await registerFreeeApiMocks(page);
    await bootstrapE2ESession(page);
  });

  test("自動登録ルール一覧を表示しフィルターと検索が動く", async ({
    page,
  }) => {
    await page.goto("/wallet-txns/rules");

    const rulesTable = page.getByRole("table");

    await expect(
      page.getByRole("heading", { name: "自動登録ルール" }),
    ).toBeVisible();
    await expect(rulesTable.getByText("Microsoft 365")).toBeVisible();
    await expect(rulesTable.getByText("振込 カ）ABC")).toBeVisible();
    await expect(rulesTable.getByText("Amazon")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "未処理明細メニュー" }).getByRole("link", {
        name: "未処理明細",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "推測" }).click();
    await expect(rulesTable.getByText("Amazon")).toBeVisible();
    await expect(rulesTable.getByText("Microsoft 365")).toHaveCount(0);

    await page.getByRole("button", { name: "自動登録" }).click();
    await expect(rulesTable.getByText("Microsoft 365")).toBeVisible();
    await expect(rulesTable.getByText("Amazon")).toHaveCount(0);

    await page.getByPlaceholder("摘要・勘定科目で検索").fill("売上");
    await expect(rulesTable.getByText("振込 カ）ABC")).toBeVisible();
    await expect(rulesTable.getByText("Microsoft 365")).toHaveCount(0);
  });

  test("未処理明細でサブナビ・フィルター・分類チップが表示される", async ({
    page,
  }) => {
    await page.goto("/wallet-txns");

    await expect(
      page.getByRole("heading", { name: "未処理明細" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "自動登録ルール" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Microsoft 365", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "DAZN サブスク", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "振込 カ）ABC", exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /^ルール一致/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^要手動設定/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^ルール一致/ }).click();
    await expect(
      page.getByRole("heading", { name: "Microsoft 365", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "DAZN サブスク", exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /^要手動設定/ }).click();
    await expect(
      page.getByRole("heading", { name: "DAZN サブスク", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Microsoft 365", exact: true }),
    ).toHaveCount(0);
  });

  test("一括プレビューから AI 提案→ルール一括作成まで進める", async ({
    page,
  }) => {
    await page.goto("/wallet-txns");

    await page.getByRole("button", { name: /^要手動設定/ }).click();
    await page.getByRole("button", { name: /表示中を全選択/ }).click();
    await page.getByRole("button", { name: "一括プレビュー" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("一括プレビュー", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("DAZN サブスク", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /AIでルールを提案/ }).click();
    await expect(page.getByText("AI提案ルール")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("サブスクリプション料金")).toBeVisible();

    await page.getByRole("checkbox", { name: /確認しました/ }).check();
    await page.getByRole("button", { name: /ルールを一括作成/ }).click();

    await expect(dialog.getByRole("status")).toContainText(
      "自動登録ルールを作成しました",
      { timeout: 15_000 },
    );
  });

  test("ルール一致明細は一括プレビューで freee 確定導線が出る", async ({
    page,
  }) => {
    await page.goto("/wallet-txns");

    await page.getByRole("button", { name: /^ルール一致/ }).click();
    await page.getByRole("button", { name: /表示中を全選択/ }).click();
    await page.getByRole("button", { name: "一括プレビュー" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("ルール一致（freeeで確定）")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "freeeで確定 ↗" }),
    ).toBeVisible();
  });
});
