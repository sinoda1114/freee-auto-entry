import type { Database } from "./types";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    partner_id INTEGER NOT NULL,
    partner_name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    email_to TEXT NOT NULL DEFAULT '',
    email_cc TEXT NOT NULL DEFAULT '',
    sending_method TEXT NOT NULL DEFAULT 'email',
    lines_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_invoice_templates_company
    ON recurring_invoice_templates (company_id, active, updated_at)`,
  `CREATE TABLE IF NOT EXISTS invoice_generation_history (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    target_month TEXT NOT NULL,
    invoice_id INTEGER NOT NULL,
    report_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(company_id, template_id, target_month)
  )`,
  `CREATE TABLE IF NOT EXISTS invoice_generation_locks (
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    target_month TEXT NOT NULL,
    reserved_at TEXT NOT NULL,
    claim_token TEXT NOT NULL,
    external_started_at TEXT,
    invoice_id INTEGER,
    report_url TEXT,
    PRIMARY KEY(company_id, template_id, target_month)
  )`,
  `ALTER TABLE invoice_generation_locks ADD COLUMN invoice_id INTEGER`,
  `ALTER TABLE invoice_generation_locks ADD COLUMN report_url TEXT`,
  `ALTER TABLE invoice_generation_locks ADD COLUMN external_started_at TEXT`,
  `ALTER TABLE invoice_generation_locks ADD COLUMN claim_token TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE recurring_invoice_templates ADD COLUMN invoice_template_id INTEGER`,
  `CREATE TABLE IF NOT EXISTS matcher_creation_locks (
    company_id TEXT NOT NULL,
    rule_key TEXT NOT NULL,
    claim_token TEXT NOT NULL,
    reserved_at TEXT NOT NULL,
    external_started_at TEXT,
    matcher_id INTEGER,
    PRIMARY KEY(company_id, rule_key)
  )`,
  `CREATE TABLE IF NOT EXISTS matcher_creation_history (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    matcher_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    account_item_name TEXT NOT NULL,
    tax_name TEXT NOT NULL,
    entry_side TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matcher_creation_history_company
    ON matcher_creation_history (company_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS support_threads (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'open',
    question_summary TEXT NOT NULL DEFAULT '',
    answer_summary TEXT NOT NULL DEFAULT '',
    background TEXT NOT NULL DEFAULT '',
    conclusion TEXT NOT NULL DEFAULT '',
    raw_email TEXT NOT NULL,
    source_url TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    freee_target_kind TEXT,
    freee_target_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `ALTER TABLE support_threads ADD COLUMN source_url TEXT`,
  `ALTER TABLE support_threads ADD COLUMN gmail_thread_id TEXT`,
  `UPDATE support_threads SET category = 'accounting'
    WHERE category IN ('expense', 'wallet')`,
  `CREATE INDEX IF NOT EXISTS idx_support_threads_company
    ON support_threads (company_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_support_threads_target
    ON support_threads (company_id, freee_target_kind, freee_target_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_gmail_thread
    ON support_threads (company_id, gmail_thread_id)
    WHERE gmail_thread_id IS NOT NULL`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS support_threads_fts USING fts5(
    thread_id UNINDEXED,
    company_id UNINDEXED,
    subject,
    question_summary,
    answer_summary,
    tags_json,
    raw_email
  )`,
  `CREATE TABLE IF NOT EXISTS support_investigations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    thread_id TEXT,
    question TEXT NOT NULL,
    target_kind TEXT,
    target_id INTEGER,
    page_path TEXT,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_support_investigations_company
    ON support_investigations (company_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_support_investigations_thread
    ON support_investigations (company_id, thread_id)`,
  `CREATE INDEX IF NOT EXISTS idx_support_investigations_target
    ON support_investigations (company_id, target_kind, target_id)`,
] as const;

let initialized = false;

export async function ensureDatabaseSchema(db: Database): Promise<void> {
  if (initialized) {
    return;
  }

  for (const statement of schemaStatements) {
    try {
      await db.execute(statement);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      const isIdempotentColumnMigration =
        statement.startsWith("ALTER TABLE") &&
        message.includes("duplicate column");
      const isOptionalFtsFailure =
        statement.includes("USING fts5") &&
        (message.includes("fts5") ||
          message.includes("no such module") ||
          message.includes("virtual table"));
      if (!isIdempotentColumnMigration && !isOptionalFtsFailure) {
        throw error;
      }
    }
  }
  initialized = true;
}
