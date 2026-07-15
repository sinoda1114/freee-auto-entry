import { randomUUID } from "node:crypto";
import type { ConsultationTargetKind } from "@/lib/ai/consultation-target";
import {
  isSupportThreadCategory,
  type SupportThreadCategory,
} from "@/lib/support/categories";
import { ensureDatabaseSchema } from "./schema";
import type { Database, SqlRow } from "./types";

export type { SupportThreadCategory } from "@/lib/support/categories";

export type SupportThreadStatus = "open" | "resolved" | "follow_up";

export interface SupportThread {
  id: string;
  companyId: string;
  subject: string;
  category: SupportThreadCategory;
  status: SupportThreadStatus;
  questionSummary: string;
  answerSummary: string;
  background: string;
  conclusion: string;
  rawEmail: string;
  sourceUrl: string | null;
  tags: string[];
  freeeTargetKind: ConsultationTargetKind | null;
  freeeTargetId: number | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateSupportThreadInput = {
  companyId: string;
  subject: string;
  category: SupportThreadCategory;
  status: SupportThreadStatus;
  questionSummary: string;
  answerSummary: string;
  background: string;
  conclusion: string;
  rawEmail: string;
  sourceUrl?: string | null;
  tags: string[];
  freeeTargetKind?: ConsultationTargetKind | null;
  freeeTargetId?: number | null;
};

export type UpdateSupportThreadInput = {
  id: string;
  companyId: string;
  subject: string;
  category: SupportThreadCategory;
  status: SupportThreadStatus;
  questionSummary: string;
  answerSummary: string;
  background: string;
  conclusion: string;
  sourceUrl?: string | null;
  tags: string[];
  freeeTargetKind?: ConsultationTargetKind | null;
  freeeTargetId?: number | null;
};

export type SupportThreadSearchFilters = {
  query?: string;
  status?: SupportThreadStatus | "all";
  category?: SupportThreadCategory | "all";
  targetKind?: ConsultationTargetKind;
  targetId?: number;
  limit?: number;
};

function readString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`support_threads row field ${key} is invalid`);
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

function readOptionalString(row: SqlRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function isStatus(value: string): value is SupportThreadStatus {
  return value === "open" || value === "resolved" || value === "follow_up";
}

function isTargetKind(value: string): value is ConsultationTargetKind {
  return value === "transfer" || value === "deal" || value === "wallet_txn";
}

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseThread(row: SqlRow): SupportThread {
  const category = readString(row, "category");
  const status = readString(row, "status");
  const targetKindRaw = row.freee_target_kind;
  const freeeTargetKind =
    typeof targetKindRaw === "string" && isTargetKind(targetKindRaw)
      ? targetKindRaw
      : null;

  return {
    id: readString(row, "id"),
    companyId: readString(row, "company_id"),
    subject: readString(row, "subject"),
    category: isSupportThreadCategory(category) ? category : "other",
    status: isStatus(status) ? status : "open",
    questionSummary: readString(row, "question_summary"),
    answerSummary: readString(row, "answer_summary"),
    background: readString(row, "background"),
    conclusion: readString(row, "conclusion"),
    rawEmail: readString(row, "raw_email"),
    sourceUrl: readOptionalString(row, "source_url"),
    tags: parseTags(readString(row, "tags_json")),
    freeeTargetKind,
    freeeTargetId: readOptionalNumber(row, "freee_target_id"),
    createdAt: readString(row, "created_at"),
    updatedAt: readString(row, "updated_at"),
  };
}

async function upsertFts(
  db: Database,
  thread: Pick<
    SupportThread,
    | "id"
    | "companyId"
    | "subject"
    | "questionSummary"
    | "answerSummary"
    | "tags"
    | "rawEmail"
  >,
): Promise<void> {
  try {
    await db.execute(
      `DELETE FROM support_threads_fts WHERE thread_id = :threadId`,
      { threadId: thread.id },
    );
    await db.execute(
      `INSERT INTO support_threads_fts (
        thread_id, company_id, subject, question_summary,
        answer_summary, tags_json, raw_email
      ) VALUES (
        :threadId, :companyId, :subject, :questionSummary,
        :answerSummary, :tagsJson, :rawEmail
      )`,
      {
        threadId: thread.id,
        companyId: thread.companyId,
        subject: thread.subject,
        questionSummary: thread.questionSummary,
        answerSummary: thread.answerSummary,
        tagsJson: JSON.stringify(thread.tags),
        rawEmail: thread.rawEmail,
      },
    );
  } catch {
    // FTS optional — LIKE fallback handles search.
  }
}

export async function createSupportThread(
  db: Database,
  input: CreateSupportThreadInput,
): Promise<SupportThread> {
  await ensureDatabaseSchema(db);
  const now = new Date().toISOString();
  const thread: SupportThread = {
    id: randomUUID(),
    companyId: input.companyId,
    subject: input.subject.trim(),
    category: input.category,
    status: input.status,
    questionSummary: input.questionSummary.trim(),
    answerSummary: input.answerSummary.trim(),
    background: input.background.trim(),
    conclusion: input.conclusion.trim(),
    rawEmail: input.rawEmail,
    sourceUrl: input.sourceUrl ?? null,
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    freeeTargetKind: input.freeeTargetKind ?? null,
    freeeTargetId: input.freeeTargetId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO support_threads (
      id, company_id, subject, category, status,
      question_summary, answer_summary, background, conclusion,
      raw_email, source_url, tags_json, freee_target_kind, freee_target_id,
      created_at, updated_at
    ) VALUES (
      :id, :companyId, :subject, :category, :status,
      :questionSummary, :answerSummary, :background, :conclusion,
      :rawEmail, :sourceUrl, :tagsJson, :freeeTargetKind, :freeeTargetId,
      :createdAt, :updatedAt
    )`,
    {
      id: thread.id,
      companyId: thread.companyId,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      questionSummary: thread.questionSummary,
      answerSummary: thread.answerSummary,
      background: thread.background,
      conclusion: thread.conclusion,
      rawEmail: thread.rawEmail,
      sourceUrl: thread.sourceUrl,
      tagsJson: JSON.stringify(thread.tags),
      freeeTargetKind: thread.freeeTargetKind,
      freeeTargetId: thread.freeeTargetId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    },
  );
  await upsertFts(db, thread);
  return thread;
}

export async function updateSupportThread(
  db: Database,
  input: UpdateSupportThreadInput,
): Promise<SupportThread> {
  await ensureDatabaseSchema(db);
  const existing = await getSupportThread(db, input.companyId, input.id);
  if (!existing) {
    throw new Error("問い合わせ履歴が見つかりません。");
  }

  const updated: SupportThread = {
    ...existing,
    subject: input.subject.trim(),
    category: input.category,
    status: input.status,
    questionSummary: input.questionSummary.trim(),
    answerSummary: input.answerSummary.trim(),
    background: input.background.trim(),
    conclusion: input.conclusion.trim(),
    sourceUrl: input.sourceUrl ?? null,
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    freeeTargetKind: input.freeeTargetKind ?? null,
    freeeTargetId: input.freeeTargetId ?? null,
    updatedAt: new Date().toISOString(),
  };

  const result = await db.execute(
    `UPDATE support_threads SET
      subject = :subject,
      category = :category,
      status = :status,
      question_summary = :questionSummary,
      answer_summary = :answerSummary,
      background = :background,
      conclusion = :conclusion,
      source_url = :sourceUrl,
      tags_json = :tagsJson,
      freee_target_kind = :freeeTargetKind,
      freee_target_id = :freeeTargetId,
      updated_at = :updatedAt
    WHERE id = :id AND company_id = :companyId`,
    {
      id: updated.id,
      companyId: updated.companyId,
      subject: updated.subject,
      category: updated.category,
      status: updated.status,
      questionSummary: updated.questionSummary,
      answerSummary: updated.answerSummary,
      background: updated.background,
      conclusion: updated.conclusion,
      sourceUrl: updated.sourceUrl,
      tagsJson: JSON.stringify(updated.tags),
      freeeTargetKind: updated.freeeTargetKind,
      freeeTargetId: updated.freeeTargetId,
      updatedAt: updated.updatedAt,
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("問い合わせ履歴を更新できませんでした。");
  }
  await upsertFts(db, updated);
  return updated;
}

export async function getSupportThread(
  db: Database,
  companyId: string,
  id: string,
): Promise<SupportThread | null> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM support_threads
      WHERE id = :id AND company_id = :companyId
      LIMIT 1`,
    { id, companyId },
  );
  const row = result.rows[0];
  return row ? parseThread(row) : null;
}

async function searchWithFts(
  db: Database,
  companyId: string,
  query: string,
  limit: number,
): Promise<string[] | null> {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/["']/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  const matchExpr = tokens.map((token) => `"${token}"*`).join(" ");
  try {
    const result = await db.execute(
      `SELECT thread_id FROM support_threads_fts
        WHERE company_id = :companyId AND support_threads_fts MATCH :matchExpr
        LIMIT :limit`,
      { companyId, matchExpr, limit },
    );
    return result.rows.map((row) => readString(row, "thread_id"));
  } catch {
    return null;
  }
}

export async function searchSupportThreads(
  db: Database,
  companyId: string,
  filters: SupportThreadSearchFilters = {},
): Promise<SupportThread[]> {
  await ensureDatabaseSchema(db);
  const limit = filters.limit ?? 50;
  const query = filters.query?.trim() ?? "";
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  const category =
    filters.category && filters.category !== "all" ? filters.category : null;

  let ftsIds: string[] | null = null;
  if (query) {
    ftsIds = await searchWithFts(db, companyId, query, limit * 3);
  }

  const clauses = ["company_id = :companyId"];
  const args: Record<string, string | number> = { companyId, limit };

  if (status) {
    clauses.push("status = :status");
    args.status = status;
  }
  if (category) {
    clauses.push("category = :category");
    args.category = category;
  }
  if (filters.targetKind && filters.targetId) {
    clauses.push(
      "freee_target_kind = :targetKind AND freee_target_id = :targetId",
    );
    args.targetKind = filters.targetKind;
    args.targetId = filters.targetId;
  }

  if (ftsIds && ftsIds.length > 0) {
    const placeholders = ftsIds.map((_, index) => {
      const key = `id${index}`;
      args[key] = ftsIds[index]!;
      return `:${key}`;
    });
    clauses.push(`id IN (${placeholders.join(", ")})`);
  } else if (query) {
    clauses.push(
      `(subject LIKE :likeQuery OR question_summary LIKE :likeQuery OR answer_summary LIKE :likeQuery OR tags_json LIKE :likeQuery OR raw_email LIKE :likeQuery)`,
    );
    args.likeQuery = `%${query}%`;
  } else if (ftsIds && ftsIds.length === 0) {
    return [];
  }

  const result = await db.execute(
    `SELECT * FROM support_threads
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT :limit`,
    args,
  );
  return result.rows.map(parseThread);
}

export async function listSupportThreadsByTarget(
  db: Database,
  companyId: string,
  kind: ConsultationTargetKind,
  ids: number[],
): Promise<SupportThread[]> {
  await ensureDatabaseSchema(db);
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const args: Record<string, string | number> = {
    companyId,
    targetKind: kind,
  };
  const placeholders = uniqueIds.map((id, index) => {
    const key = `tid${index}`;
    args[key] = id;
    return `:${key}`;
  });

  const result = await db.execute(
    `SELECT * FROM support_threads
      WHERE company_id = :companyId
        AND freee_target_kind = :targetKind
        AND freee_target_id IN (${placeholders.join(", ")})
      ORDER BY created_at DESC`,
    args,
  );
  return result.rows.map(parseThread);
}

export async function listRecentSupportThreads(
  db: Database,
  companyId: string,
  limit = 30,
): Promise<SupportThread[]> {
  return searchSupportThreads(db, companyId, { limit });
}

export async function countSupportThreadsByTargetIds(
  db: Database,
  companyId: string,
  kind: ConsultationTargetKind,
  ids: number[],
): Promise<Record<number, number>> {
  const threads = await listSupportThreadsByTarget(db, companyId, kind, ids);
  const counts: Record<number, number> = {};
  for (const thread of threads) {
    if (thread.freeeTargetId == null) {
      continue;
    }
    counts[thread.freeeTargetId] = (counts[thread.freeeTargetId] ?? 0) + 1;
  }
  return counts;
}
