import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database, SqlRow } from "./types";
import {
  createRecurringInvoiceTemplate,
  deleteRecurringInvoiceTemplate,
  hasInvoiceGeneration,
  listRecurringInvoiceTemplates,
  recordInvoiceGeneration,
} from "./recurring-invoices";

function createDatabaseMock(rows: SqlRow[] = []): Database {
  return {
    execute: vi.fn(async () => ({ rows, rowsAffected: 0 })),
  };
}

const templateInput = {
  companyId: "11122591",
  name: "月次保守",
  partnerId: 10,
  partnerName: "取引先A",
  subject: "システム保守",
  emailTo: "billing@example.com",
  emailCc: "",
  sendingMethod: "email" as const,
  invoiceTemplateId: null,
  lines: [{ description: "月次保守", quantity: 1, unitPrice: 100000, taxRate: 10 }],
};

describe("recurring invoice repository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a template scoped to the active company", async () => {
    const db = createDatabaseMock();

    const created = await createRecurringInvoiceTemplate(db, templateInput);

    expect(created.companyId).toBe("11122591");
    expect(created.active).toBe(true);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO recurring_invoice_templates"),
      expect.objectContaining({ companyId: "11122591" }),
    );
  });

  it("lists only templates for the requested company", async () => {
    const db = createDatabaseMock([
      {
        id: "template-1",
        company_id: "11122591",
        name: "月次保守",
        partner_id: 10,
        partner_name: "取引先A",
        subject: "システム保守",
        email_to: "billing@example.com",
        email_cc: "",
        sending_method: "email",
        lines_json:
          '[{"description":"月次保守","quantity":1,"unitPrice":100000,"taxRate":10}]',
        active: 1,
        created_at: "2026-07-11T00:00:00.000Z",
        updated_at: "2026-07-11T00:00:00.000Z",
      },
    ]);

    const templates = await listRecurringInvoiceTemplates(db, "11122591");

    expect(templates).toHaveLength(1);
    expect(templates[0]?.lines[0]?.unitPrice).toBe(100000);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE company_id = :companyId"),
      { companyId: "11122591" },
    );
  });

  it("records and checks a generated invoice by company, template, and month", async () => {
    const db = createDatabaseMock([{ exists_flag: 1 }]);

    await recordInvoiceGeneration(db, {
      companyId: "11122591",
      templateId: "template-1",
      targetMonth: "2026-07",
      invoiceId: 123,
      reportUrl: "https://invoice.secure.freee.co.jp/reports/invoices/123",
    });
    const exists = await hasInvoiceGeneration(db, {
      companyId: "11122591",
      templateId: "template-1",
      targetMonth: "2026-07",
    });

    expect(exists).toBe(true);
    expect(db.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("target_month = :targetMonth"),
      {
        companyId: "11122591",
        templateId: "template-1",
        targetMonth: "2026-07",
      },
    );
  });

  it("deletes a template and related generation records", async () => {
    const db = createDatabaseMock();
    db.execute = vi.fn(async (sql: string) => {
      if (sql.includes("DELETE FROM recurring_invoice_templates")) {
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 0 };
    });

    await deleteRecurringInvoiceTemplate(db, "11122591", "template-1");

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM invoice_generation_history"),
      { companyId: "11122591", templateId: "template-1" },
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM recurring_invoice_templates"),
      { companyId: "11122591", templateId: "template-1" },
    );
  });
});
