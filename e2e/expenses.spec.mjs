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
    const quickBox = await page.getByText("クイックアクション").boundingBox();
    const accountingBox = await page
      .getByRole("heading", { name: "経理" })
      .boundingBox();
    expect(quickBox).not.toBeNull();
    expect(accountingBox).not.toBeNull();
    if (!quickBox || !accountingBox) {
      throw new Error("クイックアクションまたは経理の位置が取れません。");
    }
    expect(quickBox.y).toBeLessThan(accountingBox.y);
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
    await expect(
      page.getByText("領収書をカメラ撮影、選択、または貼り付け"),
    ).toBeVisible();
    await expect(
      page.getByText("登録すると、出金元口座は役員資金で決済します。"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "最近登録した経費" }),
    ).toBeVisible();
    await expect(page.getByText("文房具")).toBeVisible();
    await expect(page.getByText("¥1,280")).toBeVisible();
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

  test("画面上の Ctrl+V は画像を読み取り、入力欄の貼り付けは奪わない", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await bootstrapE2ESession(page, {
      companyId: E2E_SHINODA_IT_COMPANY_ID,
    });
    await page.goto("/expenses/new");
    await expect(page.getByRole("heading", { name: "経費を登録" })).toBeVisible();

    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("canvas 2d が使えません。");
      }
      ctx.fillStyle = "#e85d4c";
      ctx.fillRect(0, 0, 16, 16);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("PNG を作れません。"));
        }, "image/png");
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    });

    await page.getByRole("heading", { name: "経費を登録" }).click();
    await page.keyboard.press("Control+v");

    await expect(page.getByAltText("選択した領収書のプレビュー")).toBeVisible();
    await expect(page.getByText(/読み取り完了/)).toBeVisible();
    await expect(page.locator('input[name="amount"]')).toHaveValue("1100");

    const description = page.getByPlaceholder("空欄でも登録できます");
    await description.fill("");
    await page.evaluate(async () => {
      await navigator.clipboard.writeText("手入力の摘要");
    });
    await description.click();
    await page.keyboard.press("Control+v");
    await expect(description).toHaveValue("手入力の摘要");
    await expect(page.locator('input[name="amount"]')).toHaveValue("1100");

    await page.getByRole("heading", { name: "経費を登録" }).click();
    await page.keyboard.press("Control+v");
    await expect(page.getByText("画像またはPDFを貼り付けてください。")).toHaveCount(
      0,
    );
    await expect(description).toHaveValue("手入力の摘要");
  });
});
