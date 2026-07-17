import { randomUUID } from "node:crypto";
import type { AccountingConsultationReport } from "@/lib/ai/accounting-consultation";
import type { ConsultationTargetKind } from "@/lib/ai/consultation-target";
import { ensureDatabaseSchema } from "./schema";
import type { Database, SqlRow } from "./types";

export interface SupportInvestigation {
  id: string;
  companyId: string;
  threadId: string | null;
  question: string;
  targetKind: ConsultationTargetKind | null;
  targetId: number | null;
  pagePath: string | null;
  report: AccountingConsultationReport;
  createdAt: string;
}

export type RecordSupportInvestigationInput = {
  companyId: string;
  question: string;
  report: AccountingConsultationReport;
  threadId?: string | null;
  targetKind?: ConsultationTargetKind | null;
  targetId?: number | null;
  pagePath?: string | null;
};

function readString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`support_investigations row field ${key} is invalid`);
  }
  return value;
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

function isTargetKind(value: string): value is ConsultationTargetKind {
  return value === "transfer" || value === "deal" || value === "wallet_txn";
}

function parseReport(value: string): AccountingConsultationReport {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Stored investigation report is invalid");
  }
  const report = parsed as AccountingConsultationReport;
  if (typeof report.summary !== "string") {
    throw new Error("Stored investigation report is invalid");
  }
  return {
    mode: report.mode === "present" ? "present" : "investigate",
    summary: report.summary,
    facts: Array.isArray(report.facts)
      ? report.facts.filter((item): item is string => typeof item === "string")
      : [],
    hypotheses: Array.isArray(report.hypotheses)
      ? report.hypotheses.filter(
          (item): item is AccountingConsultationReport["hypotheses"][number] =>
            typeof item === "object" &&
            item !== null &&
            typeof item.title === "string" &&
            typeof item.reasoning === "string" &&
            (item.likelihood === "high" ||
              item.likelihood === "medium" ||
              item.likelihood === "low"),
        )
      : [],
    checkpoints: Array.isArray(report.checkpoints)
      ? report.checkpoints.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    suggestions: Array.isArray(report.suggestions)
      ? report.suggestions.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function parseInvestigation(row: SqlRow): SupportInvestigation {
  const targetKindRaw = row.target_kind;
  const targetKind =
    typeof targetKindRaw === "string" && isTargetKind(targetKindRaw)
      ? targetKindRaw
      : null;
  const threadId =
    typeof row.thread_id === "string" && row.thread_id.trim()
      ? row.thread_id
      : null;
  const pagePath =
    typeof row.page_path === "string" && row.page_path.trim()
      ? row.page_path
      : null;

  return {
    id: readString(row, "id"),
    companyId: readString(row, "company_id"),
    threadId,
    question: readString(row, "question"),
    targetKind,
    targetId: readOptionalNumber(row, "target_id"),
    pagePath,
    report: parseReport(readString(row, "report_json")),
    createdAt: readString(row, "created_at"),
  };
}

export async function recordSupportInvestigation(
  db: Database,
  input: RecordSupportInvestigationInput,
): Promise<SupportInvestigation> {
  await ensureDatabaseSchema(db);
  const investigation: SupportInvestigation = {
    id: randomUUID(),
    companyId: input.companyId,
    threadId: input.threadId ?? null,
    question: input.question.trim(),
    targetKind: input.targetKind ?? null,
    targetId: input.targetId ?? null,
    pagePath: input.pagePath ?? null,
    report: input.report,
    createdAt: new Date().toISOString(),
  };

  await db.execute(
    `INSERT INTO support_investigations (
      id, company_id, thread_id, question, target_kind, target_id,
      page_path, report_json, created_at
    ) VALUES (
      :id, :companyId, :threadId, :question, :targetKind, :targetId,
      :pagePath, :reportJson, :createdAt
    )`,
    {
      id: investigation.id,
      companyId: investigation.companyId,
      threadId: investigation.threadId,
      question: investigation.question,
      targetKind: investigation.targetKind,
      targetId: investigation.targetId,
      pagePath: investigation.pagePath,
      reportJson: JSON.stringify(investigation.report),
      createdAt: investigation.createdAt,
    },
  );
  return investigation;
}

export async function getSupportInvestigation(
  db: Database,
  companyId: string,
  id: string,
): Promise<SupportInvestigation | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM support_investigations
      WHERE id = :id AND company_id = :companyId
      LIMIT 1`,
    { id, companyId },
  );
  const row = result.rows[0];
  return row ? parseInvestigation(row) : null;
}

export async function listInvestigationsForThread(
  db: Database,
  companyId: string,
  threadId: string,
): Promise<SupportInvestigation[]> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM support_investigations
      WHERE company_id = :companyId AND thread_id = :threadId
      ORDER BY created_at DESC`,
    { companyId, threadId },
  );
  return result.rows.map(parseInvestigation);
}

export async function linkInvestigationToThread(
  db: Database,
  companyId: string,
  investigationId: string,
  threadId: string,
): Promise<void> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `UPDATE support_investigations
      SET thread_id = :threadId
      WHERE id = :id AND company_id = :companyId`,
    { id: investigationId, companyId, threadId },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("調査レポートを紐づけできませんでした。");
  }
}

export async function listRecentInvestigations(
  db: Database,
  companyId: string,
  limit = 20,
): Promise<SupportInvestigation[]> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM support_investigations
      WHERE company_id = :companyId
      ORDER BY created_at DESC
      LIMIT :limit`,
    { companyId, limit },
  );
  return result.rows.map(parseInvestigation);
}
