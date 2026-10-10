import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidFreeeAuthMock = vi.fn();
const getAppMemoTagIdMock = vi.fn();
const getAccountItemsMock = vi.fn();
const createDealMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));
vi.mock("@/lib/freee/session-client", () => ({
  getValidFreeeAuth: () => getValidFreeeAuthMock(),
}));
vi.mock("@/lib/freee/memo-tag", () => ({
  getAppMemoTagId: () => getAppMemoTagIdMock(),
}));
vi.mock("@/lib/freee/accounting", () => ({
  getAccountItems: () => getAccountItemsMock(),
  getTaxCodes: vi.fn(),
  createDeal: (...args: unknown[]) => createDealMock(...args),
}));
vi.mock("@/lib/freee/receipts", () => ({
  uploadReceipt: vi.fn(),
}));
vi.mock("@/lib/ai/receipt-ocr", () => ({
  extractReceiptOcr: vi.fn(),
}));

import { createExpenseAction } from "./actions";

const accountItems = [
  { id: 10, name: "消耗品費", defaultTaxCode: 136 },
  { id: 99, name: "役員借入金", defaultTaxCode: 0 },
];

function expenseFormData() {
  const formData = new FormData();
  formData.set("issueDate", "2020-01-01");
  formData.set("accountItemId", "10");
  formData.set("taxCode", "136");
  formData.set("amount", "880");
  formData.set("description", "遡及の備品");
  return formData;
}

describe("createExpenseAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidFreeeAuthMock.mockResolvedValue({
      accessToken: "token",
      companyId: "11122591",
    });
    getAppMemoTagIdMock.mockResolvedValue(7);
    getAccountItemsMock.mockResolvedValue(accountItems);
    createDealMock.mockResolvedValue({ id: 9000 });
  });

  it("revalidates the expense page after a successful registration", async () => {
    const result = await createExpenseAction({ status: "idle" }, expenseFormData());

    expect(result).toMatchObject({
      status: "success",
      dealId: 9000,
      registeredExpense: {
        id: 9000,
        issueDate: "2020-01-01",
        amount: 880,
        description: "遡及の備品",
        accountItemName: "消耗品費",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/expenses/new");
  });

  it("does not revalidate when registration fails", async () => {
    getAccountItemsMock.mockResolvedValue([accountItems[0]]);

    const result = await createExpenseAction({ status: "idle" }, expenseFormData());

    expect(result.status).toBe("error");
    expect(createDealMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
