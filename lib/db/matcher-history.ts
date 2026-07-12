import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema } from "./schema";
import type { Database, SqlRow } from "./types";

export interface MatcherHistoryEntry {
  id: string;
  companyId: string;
  matcherId: number;
  description: string;
  accountItemName: string;
  taxName: string;
  entrySide: string;
  source: string | null;
  createdAt: string;
}

export interface RecordMatcherHistoryInput {
  companyId: string;
  matcherId: number;
  description: string;
  accountItemName: string;
  taxName: string;
  entrySide: string;
  source?: string;
}

function readString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`matcher_creation_history row field ${key} is invalid`);
  }
  return value;
}

function readNumber(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`matcher_creation_history row field ${key} is invalid`);
  }
  return Number(value);
}

function parseEntry(row: SqlRow): MatcherHistoryEntry {
  return {
    id: readString(row, "id"),
    companyId: readString(row, "company_id"),
    matcherId: readNumber(row, "matcher_id"),
    description: readString(row, "description"),
    accountItemName: readString(row, "account_item_name"),
    taxName: readString(row, "tax_name"),
    entrySide: readString(row, "entry_side"),
    source: typeof row.source === "string" ? row.source : null,
    createdAt: readString(row, "created_at"),
  };
}

export async function recordMatcherHistory(
  db: Database,
  input: RecordMatcherHistoryInput,
): Promise<void> {
  await ensureDatabaseSchema(db);
  await db.execute(
    `INSERT INTO matcher_creation_history (
      id, company_id, matcher_id, description, account_item_name,
      tax_name, entry_side, source, created_at
    ) VALUES (
      :id, :companyId, :matcherId, :description, :accountItemName,
      :taxName, :entrySide, :source, :createdAt
    )`,
    {
      id: randomUUID(),
      companyId: input.companyId,
      matcherId: input.matcherId,
      description: input.description,
      accountItemName: input.accountItemName,
      taxName: input.taxName,
      entrySide: input.entrySide,
      source: input.source ?? null,
      createdAt: new Date().toISOString(),
    },
  );
}

export async function listRecentMatcherHistory(
  db: Database,
  companyId: string,
  limit = 20,
): Promise<MatcherHistoryEntry[]> {
  await ensureDatabaseSchema(db);
  const result = await db.execute(
    `SELECT * FROM matcher_creation_history
      WHERE company_id = :companyId
      ORDER BY created_at DESC
      LIMIT :limit`,
    { companyId, limit },
  );
  return result.rows.map(parseEntry);
}
