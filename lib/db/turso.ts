import { createClient, type Client } from "@libsql/client";
import type { Database, SqlArgs, SqlRow, SqlValue } from "./types";

let database: Database | null = null;

function normalizeSqlValue(value: unknown): SqlValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new Error("Turso returned an unsupported binary value");
}

function wrapClient(client: Client): Database {
  return {
    async execute(sql: string, args: SqlArgs = {}) {
      const result = await client.execute({ sql, args });
      const rows: SqlRow[] = result.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            normalizeSqlValue(value),
          ]),
        ),
      );
      return { rows, rowsAffected: result.rowsAffected };
    },
  };
}

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const url =
    process.env.TURSO_DATABASE_URL ??
    (process.env.NODE_ENV === "production" ? undefined : "file:.freee-local.db");
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || (url.startsWith("libsql:") && !authToken)) {
    throw new Error(
      "Tursoが未設定です。TURSO_DATABASE_URLとTURSO_AUTH_TOKENを設定してください。",
    );
  }

  database = wrapClient(createClient({ url, authToken }));
  return database;
}
