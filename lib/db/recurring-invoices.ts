import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema } from "./schema";
import type { Database, SqlRow } from "./types";

export interface InvoiceTemplateLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export type InvoiceSendingMethod =
  | "email"
  | "posting"
  | "email_and_posting";

export interface RecurringInvoiceTemplate {
  id: string;
  companyId: string;
  name: string;
  partnerId: number;
  partnerName: string;
  subject: string;
  emailTo: string;
  emailCc: string;
  sendingMethod: InvoiceSendingMethod;
  invoiceTemplateId: number | null;
  lines: InvoiceTemplateLine[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateRecurringInvoiceTemplateInput = Omit<
  RecurringInvoiceTemplate,
  "id" | "active" | "createdAt" | "updatedAt"
>;

export type UpdateRecurringInvoiceTemplateInput = Omit<
  RecurringInvoiceTemplate,
  "companyId" | "active" | "createdAt" | "updatedAt"
>;

export type RecurringInvoiceTemplatePrefill = Omit<
  CreateRecurringInvoiceTemplateInput,
  "companyId"
>;

function readString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Database row field ${key} is invalid`);
  }
  return value;
}

function readNumber(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Database row field ${key} is invalid`);
  }
  return Number(value);
}

function isTemplateLine(value: unknown): value is InvoiceTemplateLine {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "description" in value &&
    typeof value.description === "string" &&
    "quantity" in value &&
    typeof value.quantity === "number" &&
    "unitPrice" in value &&
    typeof value.unitPrice === "number" &&
    "taxRate" in value &&
    typeof value.taxRate === "number"
  );
}

function parseLines(value: string): InvoiceTemplateLine[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isTemplateLine)) {
    throw new Error("Stored invoice lines are invalid");
  }
  return parsed;
}

function parseSendingMethod(value: string): InvoiceSendingMethod {
  if (
    value === "email" ||
    value === "posting" ||
    value === "email_and_posting"
  ) {
    return value;
  }
  throw new Error("Stored sending method is invalid");
}

function readOptionalNumber(row: SqlRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

function parseTemplate(row: SqlRow): RecurringInvoiceTemplate {
  return {
    id: readString(row, "id"),
    companyId: readString(row, "company_id"),
    name: readString(row, "name"),
    partnerId: readNumber(row, "partner_id"),
    partnerName: readString(row, "partner_name"),
    subject: readString(row, "subject"),
    emailTo: readString(row, "email_to"),
    emailCc: readString(row, "email_cc"),
    sendingMethod: parseSendingMethod(readString(row, "sending_method")),
    invoiceTemplateId: readOptionalNumber(row, "invoice_template_id"),
    lines: parseLines(readString(row, "lines_json")),
    active: readNumber(row, "active") === 1,
    createdAt: readString(row, "created_at"),
    updatedAt: readString(row, "updated_at"),
  };
}

export async function createRecurringInvoiceTemplate(
  db: Database,
  input: CreateRecurringInvoiceTemplateInput,
): Promise<RecurringInvoiceTemplate> {
  await ensureDatabaseSchema(db);
  const now = new Date().toISOString();
  const template: RecurringInvoiceTemplate = {
    ...input,
    id: randomUUID(),
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO recurring_invoice_templates (
      id, company_id, name, partner_id, partner_name, subject, email_to,
      email_cc, sending_method, invoice_template_id, lines_json, active, created_at, updated_at
    ) VALUES (
      :id, :companyId, :name, :partnerId, :partnerName, :subject, :emailTo,
      :emailCc, :sendingMethod, :invoiceTemplateId, :linesJson, 1, :createdAt, :updatedAt
    )`,
    {
      id: template.id,
      companyId: template.companyId,
      name: template.name,
      partnerId: template.partnerId,
      partnerName: template.partnerName,
      subject: template.subject,
      emailTo: template.emailTo,
      emailCc: template.emailCc,
      sendingMethod: template.sendingMethod,
      invoiceTemplateId: template.invoiceTemplateId,
      linesJson: JSON.stringify(template.lines),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
  );
  return template;
}

export async function listRecurringInvoiceTemplates(
  db: Database,
  companyId: string,
): Promise<RecurringInvoiceTemplate[]> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM recurring_invoice_templates
      WHERE company_id = :companyId
      ORDER BY active DESC, updated_at DESC`,
    { companyId },
  );
  return result.rows.map(parseTemplate);
}

export async function getRecurringInvoiceTemplate(
  db: Database,
  companyId: string,
  templateId: string,
): Promise<RecurringInvoiceTemplate | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM recurring_invoice_templates
      WHERE company_id = :companyId AND id = :templateId
      LIMIT 1`,
    { companyId, templateId },
  );
  const row = result.rows[0];
  return row ? parseTemplate(row) : null;
}

export async function updateRecurringInvoiceTemplate(
  db: Database,
  companyId: string,
  input: UpdateRecurringInvoiceTemplateInput,
): Promise<void> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `UPDATE recurring_invoice_templates SET
      name = :name, partner_id = :partnerId, partner_name = :partnerName,
      subject = :subject, email_to = :emailTo, email_cc = :emailCc,
      sending_method = :sendingMethod, invoice_template_id = :invoiceTemplateId,
      lines_json = :linesJson, updated_at = :updatedAt
    WHERE company_id = :companyId AND id = :id`,
    {
      companyId,
      id: input.id,
      name: input.name,
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      subject: input.subject,
      emailTo: input.emailTo,
      emailCc: input.emailCc,
      sendingMethod: input.sendingMethod,
      invoiceTemplateId: input.invoiceTemplateId,
      linesJson: JSON.stringify(input.lines),
      updatedAt: new Date().toISOString(),
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("更新する定型請求が見つかりません。");
  }
}

export async function setRecurringInvoiceTemplateActive(
  db: Database,
  companyId: string,
  templateId: string,
  active: boolean,
): Promise<void> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `UPDATE recurring_invoice_templates
      SET active = :active, updated_at = :updatedAt
      WHERE company_id = :companyId AND id = :templateId`,
    {
      companyId,
      templateId,
      active: active ? 1 : 0,
      updatedAt: new Date().toISOString(),
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("状態を変更する定型請求が見つかりません。");
  }
}

export async function deleteRecurringInvoiceTemplate(
  db: Database,
  companyId: string,
  templateId: string,
): Promise<void> {
  await ensureDatabaseSchema(db);
  await db.execute(
    `DELETE FROM invoice_generation_history
      WHERE company_id = :companyId AND template_id = :templateId`,
    { companyId, templateId },
  );
  await db.execute(
    `DELETE FROM invoice_generation_locks
      WHERE company_id = :companyId AND template_id = :templateId`,
    { companyId, templateId },
  );
  const result = await db.execute(
    `DELETE FROM recurring_invoice_templates
      WHERE company_id = :companyId AND id = :templateId`,
    { companyId, templateId },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("削除する定型請求が見つかりません。");
  }
}

export interface InvoiceGenerationKey {
  companyId: string;
  templateId: string;
  targetMonth: string;
}

export interface InvoiceGenerationClaim extends InvoiceGenerationKey {
  claimToken: string;
}

const GENERATION_LEASE_MS = 15 * 60 * 1_000;

export async function hasInvoiceGeneration(
  db: Database,
  key: InvoiceGenerationKey,
): Promise<boolean> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT 1 AS exists_flag FROM invoice_generation_history
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
      LIMIT 1`,
    {
      companyId: key.companyId,
      templateId: key.templateId,
      targetMonth: key.targetMonth,
    },
  );
  return result.rows.length > 0;
}

export async function claimInvoiceGeneration(
  db: Database,
  key: InvoiceGenerationKey,
): Promise<string | null> {
  await ensureDatabaseSchema(db);
  if (await hasInvoiceGeneration(db, key)) {
    return null;
  }
  const claimToken = randomUUID();
  try {
    await db.execute(
      `INSERT INTO invoice_generation_locks (
        company_id, template_id, target_month, reserved_at, claim_token
      ) VALUES (
        :companyId, :templateId, :targetMonth, :reservedAt, :claimToken
      )`,
      {
        companyId: key.companyId,
        templateId: key.templateId,
        targetMonth: key.targetMonth,
        reservedAt: new Date().toISOString(),
        claimToken,
      },
    );
    if (await hasInvoiceGeneration(db, key)) {
      await releaseInvoiceGenerationClaim(db, { ...key, claimToken });
      return null;
    }
    return claimToken;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("unique")
    ) {
      const existing = await db.execute(
        `SELECT reserved_at, external_started_at, invoice_id
          FROM invoice_generation_locks
          WHERE company_id = :companyId
            AND template_id = :templateId
            AND target_month = :targetMonth
          LIMIT 1`,
        {
          companyId: key.companyId,
          templateId: key.templateId,
          targetMonth: key.targetMonth,
        },
      );
      const row = existing.rows[0];
      const reservedAt =
        typeof row?.reserved_at === "string"
          ? Date.parse(row.reserved_at)
          : Number.NaN;
      const canReclaim =
        row?.external_started_at === null &&
        row?.invoice_id === null &&
        Number.isFinite(reservedAt) &&
        Date.now() - reservedAt >= GENERATION_LEASE_MS;
      if (canReclaim) {
        const deleted = await db.execute(
          `DELETE FROM invoice_generation_locks
            WHERE company_id = :companyId
              AND template_id = :templateId
              AND target_month = :targetMonth
              AND reserved_at = :reservedAt
              AND external_started_at IS NULL
              AND invoice_id IS NULL`,
          {
            companyId: key.companyId,
            templateId: key.templateId,
            targetMonth: key.targetMonth,
            reservedAt: row.reserved_at,
          },
        );
        if (deleted.rowsAffected === 1) {
          return claimInvoiceGeneration(db, key);
        }
      }
      return null;
    }
    throw error;
  }
}

export async function markInvoiceGenerationStarted(
  db: Database,
  claim: InvoiceGenerationClaim,
): Promise<void> {
  const result = await db.execute(
    `UPDATE invoice_generation_locks
      SET external_started_at = :startedAt
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
        AND claim_token = :claimToken
        AND external_started_at IS NULL`,
    {
      ...claim,
      startedAt: new Date().toISOString(),
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("請求書作成ロックを更新できませんでした。");
  }
}

export async function releaseInvoiceGenerationClaim(
  db: Database,
  claim: InvoiceGenerationClaim,
): Promise<void> {
  const result = await db.execute(
    `DELETE FROM invoice_generation_locks
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
        AND claim_token = :claimToken`,
    {
      companyId: claim.companyId,
      templateId: claim.templateId,
      targetMonth: claim.targetMonth,
      claimToken: claim.claimToken,
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("請求書作成ロックを解放できませんでした。");
  }
}

export interface InvoiceGenerationResult {
  invoiceId: number;
  reportUrl: string;
}

export async function saveInvoiceGenerationClaimResult(
  db: Database,
  claim: InvoiceGenerationClaim,
  result: InvoiceGenerationResult,
): Promise<void> {
  const update = await db.execute(
    `UPDATE invoice_generation_locks
      SET invoice_id = :invoiceId, report_url = :reportUrl
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
        AND claim_token = :claimToken`,
    {
      ...claim,
      invoiceId: result.invoiceId,
      reportUrl: result.reportUrl,
    },
  );
  if (update.rowsAffected !== 1) {
    throw new Error("請求書の作成結果を保存できませんでした。");
  }
}

export async function getInvoiceGenerationClaimResult(
  db: Database,
  key: InvoiceGenerationKey,
): Promise<InvoiceGenerationResult | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT invoice_id, report_url FROM invoice_generation_locks
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
      LIMIT 1`,
    {
      companyId: key.companyId,
      templateId: key.templateId,
      targetMonth: key.targetMonth,
    },
  );
  const row = result.rows[0];
  return typeof row?.invoice_id === "number" &&
    typeof row.report_url === "string" &&
    row.report_url.length > 0
    ? { invoiceId: row.invoice_id, reportUrl: row.report_url }
    : null;
}

export async function getRecordedInvoiceGeneration(
  db: Database,
  key: InvoiceGenerationKey,
): Promise<InvoiceGenerationResult | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT invoice_id, report_url FROM invoice_generation_history
      WHERE company_id = :companyId
        AND template_id = :templateId
        AND target_month = :targetMonth
      LIMIT 1`,
    {
      companyId: key.companyId,
      templateId: key.templateId,
      targetMonth: key.targetMonth,
    },
  );
  const row = result.rows[0];
  return typeof row?.invoice_id === "number" &&
    typeof row.report_url === "string" &&
    row.report_url.length > 0
    ? { invoiceId: row.invoice_id, reportUrl: row.report_url }
    : null;
}

export async function getLastInvoiceGenerationForTemplate(
  db: Database,
  companyId: string,
  templateId: string,
): Promise<(InvoiceGenerationKey & InvoiceGenerationResult) | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT template_id, target_month, invoice_id, report_url
      FROM invoice_generation_history
      WHERE company_id = :companyId AND template_id = :templateId
      ORDER BY target_month DESC
      LIMIT 1`,
    { companyId, templateId },
  );
  const row = result.rows[0];
  if (
    !row ||
    typeof row.invoice_id !== "number" ||
    typeof row.report_url !== "string" ||
    typeof row.target_month !== "string"
  ) {
    return null;
  }
  return {
    companyId,
    templateId,
    targetMonth: row.target_month,
    invoiceId: row.invoice_id,
    reportUrl: row.report_url,
  };
}

export async function recordInvoiceGeneration(
  db: Database,
  input: InvoiceGenerationKey & {
    invoiceId: number;
    reportUrl: string;
  },
): Promise<void> {
  await ensureDatabaseSchema(db);
  await db.execute(
    `INSERT INTO invoice_generation_history (
      id, company_id, template_id, target_month, invoice_id, report_url, created_at
    ) VALUES (
      :id, :companyId, :templateId, :targetMonth, :invoiceId, :reportUrl, :createdAt
    )`,
    {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    },
  );
}
