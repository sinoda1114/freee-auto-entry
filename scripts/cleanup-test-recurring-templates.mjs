import { createClient } from "@libsql/client";

const TEST_NAME_PATTERN = /(動作確認|CRUD確認|ローカルCRUD)/;

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "file:.freee-local.db");
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }

  const client = createClient({ url, authToken });
  const result = await client.execute(
    "SELECT id, company_id, name FROM recurring_invoice_templates",
  );

  let deleted = 0;
  for (const row of result.rows) {
    const id = String(row.id);
    const companyId = String(row.company_id);
    const name = String(row.name);
    if (!TEST_NAME_PATTERN.test(name)) {
      continue;
    }

    await client.execute({
      sql: `DELETE FROM invoice_generation_history
            WHERE company_id = ? AND template_id = ?`,
      args: [companyId, id],
    });
    await client.execute({
      sql: `DELETE FROM invoice_generation_locks
            WHERE company_id = ? AND template_id = ?`,
      args: [companyId, id],
    });
    await client.execute({
      sql: `DELETE FROM recurring_invoice_templates
            WHERE company_id = ? AND id = ?`,
      args: [companyId, id],
    });
    deleted += 1;
    console.log(`deleted: ${name} (${id})`);
  }

  console.log(`done. deleted ${deleted} template(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
