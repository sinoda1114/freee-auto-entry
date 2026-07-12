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
      const isIdempotentColumnMigration =
        statement.startsWith("ALTER TABLE") &&
        error instanceof Error &&
        error.message.toLowerCase().includes("duplicate column");
      if (!isIdempotentColumnMigration) {
        throw error;
      }
    }
  }
  initialized = true;
}
