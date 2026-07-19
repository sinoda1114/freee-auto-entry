import { expect, test } from "@playwright/test";
import {
  bootstrapE2ESession,
  registerFreeeApiMocks,
} from "./helpers/freee-api-mocks.mjs";

test.describe("請求書一覧 E2E", () => {
  test.beforeEach(async ({ page }) => {
    await registerFreeeApiMocks(page);
    await bootstrapE2ESession(page);
  });

  test("最新の請求書が先頭に表示される", async ({ page }) => {
    await page.goto("/invoices");

    await expect(page.getByRole("heading", { name: "請求書" })).toBeVisible();
    await expect(page.getByText("AWS運用保守 6月分")).toBeVisible();
    await expect(page.getByText("7月分 サービス費用")).toBeVisible();
    await expect(page.getByText("古い請求（2024）")).toBeVisible();

    const subjects = page.locator("article h2");
    await expect(subjects.nth(0)).toHaveText("7月分 サービス費用");
    await expect(subjects.nth(1)).toHaveText("AWS運用保守 6月分");
  });

  test("再取得ボタンが表示される", async ({ page }) => {
    await page.goto("/invoices");
    await expect(
      page.getByRole("button", { name: "freeeから再取得" }),
    ).toBeVisible();
  });
});
