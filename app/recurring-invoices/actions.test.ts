import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidFreeeAuthMock = vi.fn();
const getDatabaseMock = vi.fn(() => ({ execute: vi.fn() }));
const claimInvoiceGenerationMock = vi.fn();
const getInvoiceGenerationClaimResultMock = vi.fn();
const getRecordedInvoiceGenerationMock = vi.fn();
const getTemplateMock = vi.fn();
const createInvoiceMock = vi.fn();
const recordInvoiceGenerationMock = vi.fn();
const saveInvoiceGenerationClaimResultMock = vi.fn();
const releaseInvoiceGenerationClaimMock = vi.fn();
const getAppMemoTagIdMock = vi.fn();
const deleteRecurringInvoiceTemplateMock = vi.fn();

vi.mock("@/lib/freee/session-client", () => ({
  getValidFreeeAuth: () => getValidFreeeAuthMock(),
}));
vi.mock("@/lib/db/turso", () => ({
  getDatabase: () => getDatabaseMock(),
}));
vi.mock("@/lib/db/recurring-invoices", () => ({
  createRecurringInvoiceTemplate: vi.fn(),
  updateRecurringInvoiceTemplate: vi.fn(),
  setRecurringInvoiceTemplateActive: vi.fn(),
  deleteRecurringInvoiceTemplate: (...args: unknown[]) =>
    deleteRecurringInvoiceTemplateMock(...args),
  getRecurringInvoiceTemplate: (...args: unknown[]) =>
    getTemplateMock(...args),
  claimInvoiceGeneration: (...args: unknown[]) =>
    claimInvoiceGenerationMock(...args),
  getInvoiceGenerationClaimResult: (...args: unknown[]) =>
    getInvoiceGenerationClaimResultMock(...args),
  getRecordedInvoiceGeneration: (...args: unknown[]) =>
    getRecordedInvoiceGenerationMock(...args),
  markInvoiceGenerationStarted: vi.fn(),
  recordInvoiceGeneration: (...args: unknown[]) =>
    recordInvoiceGenerationMock(...args),
  releaseInvoiceGenerationClaim: (...args: unknown[]) =>
    releaseInvoiceGenerationClaimMock(...args),
  saveInvoiceGenerationClaimResult: (...args: unknown[]) =>
    saveInvoiceGenerationClaimResultMock(...args),
}));
vi.mock("@/lib/freee/invoice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/freee/invoice")>();
  return {
    ...actual,
    createInvoice: (...args: unknown[]) => createInvoiceMock(...args),
  };
});
vi.mock("@/lib/freee/memo-tag", () => ({
  getAppMemoTagId: (...args: unknown[]) => getAppMemoTagIdMock(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteTemplateAction,
  generateRecurringInvoiceAction,
  saveTemplateAction,
} from "./actions";
import { FreeeInvoiceApiError } from "@/lib/freee/invoice";

describe("recurring invoice actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidFreeeAuthMock.mockResolvedValue({
      accessToken: "token",
      companyId: "11122591",
    });
    getAppMemoTagIdMock.mockResolvedValue(7);
  });

  it("rejects template writes for a stale company form", async () => {
    const formData = new FormData();
    formData.set("companyId", "11040830");

    const result = await saveTemplateAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
  });

  it("deletes a template for the active company", async () => {
    deleteRecurringInvoiceTemplateMock.mockResolvedValue(undefined);
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");

    const result = await deleteTemplateAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(deleteRecurringInvoiceTemplateMock).toHaveBeenCalledWith(
      expect.anything(),
      "11122591",
      "template-1",
    );
  });

  it("warns before creating the same template for the same month twice", async () => {
    claimInvoiceGenerationMock.mockResolvedValue(null);
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      name: "月次保守",
      partnerId: 10,
      partnerName: "取引先A",
      subject: "保守費",
      emailTo: "",
      emailCc: "",
      sendingMethod: "email",
      lines: [
        {
          description: "月次保守",
          quantity: 1,
          unitPrice: 100000,
          taxRate: 10,
        },
      ],
      active: true,
      createdAt: "2026-07-01",
      updatedAt: "2026-07-01",
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("paymentDate", "2026-08-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("duplicate");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("rejects invalid edited lines instead of using template defaults", async () => {
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      partnerId: 10,
      active: true,
      lines: [
        {
          description: "月次保守",
          quantity: 1,
          unitPrice: 100000,
          taxRate: 10,
        },
      ],
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "not-a-number");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(claimInvoiceGenerationMock).not.toHaveBeenCalled();
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("returns the recoverable invoice when a previous history write failed", async () => {
    claimInvoiceGenerationMock.mockResolvedValue(null);
    getInvoiceGenerationClaimResultMock.mockResolvedValue(null);
    getRecordedInvoiceGenerationMock.mockResolvedValue({
      invoiceId: 123,
      reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/123",
    });
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      partnerId: 10,
      active: true,
      lines: [{ description: "月次保守", quantity: 1, unitPrice: 1, taxRate: 10 }],
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result).toMatchObject({
      status: "duplicate",
      invoiceId: 123,
      reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/123",
    });
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("releases the generation claim when memo tag loading fails", async () => {
    claimInvoiceGenerationMock.mockResolvedValue("claim-token");
    getAppMemoTagIdMock.mockRejectedValue(new Error("memo tag failed"));
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      partnerId: 10,
      active: true,
      emailTo: "",
      emailCc: "",
      lines: [{ description: "月次保守", quantity: 1, unitPrice: 1, taxRate: 10 }],
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(releaseInvoiceGenerationClaimMock).toHaveBeenCalledOnce();
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("keeps the claim when the external invoice result is uncertain", async () => {
    claimInvoiceGenerationMock.mockResolvedValue("claim-token");
    createInvoiceMock.mockRejectedValue(new TypeError("fetch failed"));
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      partnerId: 10,
      active: true,
      emailTo: "",
      emailCc: "",
      sendingMethod: "email",
      lines: [{ description: "月次保守", quantity: 1, unitPrice: 1, taxRate: 10 }],
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("再実行せず");
    expect(releaseInvoiceGenerationClaimMock).not.toHaveBeenCalled();
  });

  it("releases the claim when freee definitively rejects invoice creation", async () => {
    claimInvoiceGenerationMock.mockResolvedValue("claim-token");
    createInvoiceMock.mockRejectedValue(
      new FreeeInvoiceApiError(422, "invalid invoice"),
    );
    getTemplateMock.mockResolvedValue({
      id: "template-1",
      companyId: "11122591",
      partnerId: 10,
      active: true,
      emailTo: "",
      emailCc: "",
      sendingMethod: "email",
      lines: [{ description: "月次保守", quantity: 1, unitPrice: 1, taxRate: 10 }],
    });
    const formData = new FormData();
    formData.set("companyId", "11122591");
    formData.set("templateId", "template-1");
    formData.set("targetMonth", "2026-07");
    formData.set("billingDate", "2026-07-31");
    formData.set("confirmed", "on");
    formData.append("lineDescription", "月次保守");
    formData.append("lineQuantity", "1");
    formData.append("lineUnitPrice", "100000");
    formData.append("lineTaxRate", "10");

    const result = await generateRecurringInvoiceAction(
      { status: "idle" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(releaseInvoiceGenerationClaimMock).toHaveBeenCalledOnce();
  });
});
