import { HeroUIProvider } from "@heroui/react";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpensePageView } from "./ExpensePageView";

const createExpenseActionMock = vi.fn();

vi.mock("./actions", () => ({
  createExpenseAction: (...args: unknown[]) => createExpenseActionMock(...args),
  ocrReceiptAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
  });

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

  it("shows a just-registered expense before the server list refreshes", async () => {
    localStorage.setItem(
      "expense.accountItems.recent.11122591",
      JSON.stringify([10]),
    );
    createExpenseActionMock.mockResolvedValue({
      status: "success",
      dealId: 9000,
      message: "役員資金で決済まで登録しました。",
      registeredExpense: {
        id: 9000,
        issueDate: "2020-01-01",
        amount: 880,
        description: "遡及の備品",
        accountItemName: "消耗品費",
      },
    });
    renderPage([]);

    const accountChip = await screen.findByRole("button", { name: "消耗品費" });
    fireEvent.click(accountChip);
    fireEvent.change(screen.getByLabelText("発生日"), {
      target: { value: "2020-01-01" },
    });
    fireEvent.change(screen.getByLabelText("金額（円）"), {
      target: { value: "880" },
    });
    fireEvent.change(screen.getByLabelText("摘要（任意）"), {
      target: { value: "遡及の備品" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText("2020-01-01")).toBeInTheDocument();
    expect(screen.getByText("¥880")).toBeInTheDocument();
    expect(screen.getByText("消耗品費 · 遡及の備品")).toBeInTheDocument();
    expect(
      screen.queryByText("まだ登録した経費はありません。"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(createExpenseActionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("drops a just-registered row when the company changes", async () => {
    localStorage.setItem(
      "expense.accountItems.recent.11122591",
      JSON.stringify([10]),
    );
    createExpenseActionMock.mockResolvedValue({
      status: "success",
      dealId: 9000,
      message: "役員資金で決済まで登録しました。",
      registeredExpense: {
        id: 9000,
        issueDate: "2020-01-01",
        amount: 880,
        description: "遡及の備品",
        accountItemName: "消耗品費",
      },
    });
    const view = renderPage([]);
    fireEvent.click(await screen.findByRole("button", { name: "消耗品費" }));
    fireEvent.change(screen.getByLabelText("発生日"), {
      target: { value: "2020-01-01" },
    });
    fireEvent.change(screen.getByLabelText("金額（円）"), {
      target: { value: "880" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));
    expect(await screen.findByText("遡及の備品", { exact: false })).toBeInTheDocument();

    view.rerender(
      <HeroUIProvider>
        <ExpensePageView
          companyId="11040830"
          accountItems={accountItems}
          taxCodes={taxCodes}
          recentExpenses={[]}
          recentExpensesUnavailable={false}
        />
      </HeroUIProvider>,
    );

    expect(screen.queryByText("2020-01-01")).not.toBeInTheDocument();
    expect(screen.getByText("まだ登録した経費はありません。")).toBeInTheDocument();
  });
});
