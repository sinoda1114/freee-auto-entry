import { expect, test } from "@playwright/test";
import {
  bootstrapE2ESession,
  E2E_NON_EXPENSE_COMPANY_ID,
  E2E_SHINODA_IT_COMPANY_ID,
  registerFreeeApiMocks,
} from "./helpers/freee-api-mocks.mjs";

test.describe("経費（領収書）E2E", () => {
  test.beforeEach(async ({ page }) => {
    await registerFreeeApiMocks(page);
  });

  test("篠田 ITサービス選択時はホームに経費クイックアクションとナビが出る", async ({
    page,
  }) => {
    await bootstrapE2ESession(page, {
      companyId: E2E_SHINODA_IT_COMPANY_ID,
    });

    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "経費を撮影・登録" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "経費", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /経費（領収書OCR）/ }),
    ).toBeVisible();
    await expect(
      page.getByText("経費は対応事業所選択時のみ"),
    ).toHaveCount(0);
  });

  test("篠田 ITサービス選択時は経費登録ページを開ける", async ({ page }) => {
    await bootstrapE2ESession(page, {
      companyId: E2E_SHINODA_IT_COMPANY_ID,
    });

    await page.goto("/expenses/new");

    await expect(
      page.getByRole("heading", { name: "経費を登録" }),
    ).toBeVisible();
    await expect(page.getByText("領収書をカメラ撮影または選択すると")).toBeVisible();
    await expect(
      page.getByText("登録すると、出金元口座は役員資金で決済します。"),
    ).toBeVisible();
    await expect(page.getByText("経費登録は対応事業所のみ利用できます")).toHaveCount(
      0,
    );
  });

  test("非対応事業所では経費がブロックされる", async ({ page }) => {
    await bootstrapE2ESession(page, {
      companyId: E2E_NON_EXPENSE_COMPANY_ID,
    });

    await page.goto("/");

    await expect(
      page.getByText("経費は対応事業所選択時のみ"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "経費を撮影・登録" }),
    ).toHaveCount(0);

    await page.goto("/expenses/new");
    await expect(
      page.getByText(/経費登録は対応事業所のみ利用できます/),
    ).toBeVisible();
  });
});
