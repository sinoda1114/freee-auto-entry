import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";
import { ExpensePageView } from "./ExpensePageView";

const accountItems = [{ id: 10, name: "消耗品費", defaultTaxCode: 136 }];
const taxCodes = [{ code: 136, name: "課対仕入10%" }];

function renderPage(
  recentExpenses: Array<{
    id: number;
    issueDate: string;
    amount: number;
    description: string | null;
    accountItemName: string | null;
  }>,
  recentExpensesUnavailable = false,
) {
  return render(
    <ExpensePageView
      companyId="11122591"
      accountItems={accountItems}
      taxCodes={taxCodes}
      recentExpenses={recentExpenses}
      recentExpensesUnavailable={recentExpensesUnavailable}
    />,
  );
}

describe("ExpensePageView recent expenses", () => {
  it("shows an empty message when nothing has been registered", () => {
    renderPage([]);

    expect(
      screen.getByRole("heading", { name: "最近登録した経費" }),
    ).toBeInTheDocument();
    expect(screen.getByText("まだ登録した経費はありません。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "経費を登録" })).toBeInTheDocument();
  });

  it("shows fewer than five registered expenses with date, amount, account, and description", () => {
    renderPage([
      {
        id: 3,
        issueDate: "2026-10-08",
        amount: 1280,
        description: "文房具",
        accountItemName: "消耗品費",
      },
      {
        id: 2,
        issueDate: "2026-10-02",
        amount: 540,
        description: null,
        accountItemName: "旅費交通費",
      },
    ]);

    expect(screen.getByText("2026-10-08")).toBeInTheDocument();
    expect(screen.getByText("¥1,280")).toBeInTheDocument();
    expect(screen.getByText("消耗品費 · 文房具")).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
    expect(screen.getByText("¥540")).toBeInTheDocument();
    expect(screen.getByText("旅費交通費 · 摘要なし")).toBeInTheDocument();
    expect(screen.queryByText("まだ登録した経費はありません。")).not.toBeInTheDocument();
  });

  it("shows a short failure message without hiding the registration form", () => {
    renderPage([], true);

    expect(screen.getByText("直近の経費を表示できませんでした。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録する" })).toBeInTheDocument();
  });
});
