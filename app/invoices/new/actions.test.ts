import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidFreeeAuthMock = vi.fn();
const createInvoiceMock = vi.fn();

vi.mock("@/lib/freee/session-client", () => ({
  getValidFreeeAuth: () => getValidFreeeAuthMock(),
}));
vi.mock("@/lib/freee/invoice", () => ({
  createInvoice: (...args: unknown[]) => createInvoiceMock(...args),
}));
vi.mock("@/lib/freee/memo-tag", () => ({
  getAppMemoTagId: vi.fn().mockResolvedValue(7),
}));

import { createInvoiceAction } from "./actions";

describe("createInvoiceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidFreeeAuthMock.mockResolvedValue({
      accessToken: "token",
      companyId: "11122591",
    });
    createInvoiceMock.mockResolvedValue({
      id: 1,
      reportUrl: "https://invoice.example/1",
    });
  });

  it("passes multiple lines, recipients, and payment date to freee", async () => {
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("billingDate", "2026-07-31");
    formData.set("paymentDate", "2026-08-31");
    formData.set("partnerId", "55");
    formData.set("subject", "7月分");
    formData.set("emailTo", "billing@example.com");
    formData.append("lineDescription", "保守");
    formData.append("lineDescription", "追加作業");
    formData.append("lineQuantity", "1");
    formData.append("lineQuantity", "2");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineUnitPrice", "5000");
    formData.append("lineTaxRate", "10");
    formData.append("lineTaxRate", "10");

    const result = await createInvoiceAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(createInvoiceMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentDate: "2026-08-31",
        emailTo: "billing@example.com",
        lines: [
          {
            description: "保守",
            quantity: 1,
            unitPrice: 100000,
            taxRate: 10,
          },
          {
            description: "追加作業",
            quantity: 2,
            unitPrice: 5000,
            taxRate: 10,
          },
        ],
      }),
    );
  });

  it("rejects mismatched line arrays", async () => {
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("billingDate", "2026-07-31");
    formData.set("partnerId", "55");
    formData.append("lineDescription", "保守");
    formData.append("lineQuantity", "1");
    formData.append("lineQuantity", "2");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await createInvoiceAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("rejects empty entries in comma-separated CC recipients", async () => {
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("billingDate", "2026-07-31");
    formData.set("partnerId", "55");
    formData.set("emailCc", "one@example.com,,two@example.com");
    formData.append("lineDescription", "保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await createInvoiceAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });
});
