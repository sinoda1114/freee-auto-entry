/**
 * One-shot importer: intermediate JSON (from Gmail MCP collection) → Turso.
 *
 * Usage:
 *   npx tsx scripts/import-support-gmail-once.ts \
 *     --input tmp/support-gmail-import.json \
 *     --company-id <freee_company_id>
 *
 * JSON shape:
 * {
 *   "threads": [
 *     {
 *       "gmailThreadId": "…",
 *       "subject": "…",
 *       "rawEmail": "…",
 *       "sourceUrl": null
 *     }
 *   ]
 * }
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSupportEmailWithLlm } from "../lib/ai/support-email-parse";
import {
  createSupportThread,
  findSupportThreadByGmailThreadId,
} from "../lib/db/support-threads";
import { getDatabase } from "../lib/db/turso";

interface ImportThreadInput {
  gmailThreadId: string;
  subject?: string;
  rawEmail: string;
  sourceUrl?: string | null;
}

interface ImportFile {
  threads: ImportThreadInput[];
}

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // rely on process env
  }
}

function parseArgs(argv: string[]): {
  input: string;
  companyId: string;
  dryRun: boolean;
} {
  let input = "";
  let companyId = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") {
      input = argv[++i] ?? "";
    } else if (arg === "--company-id") {
      companyId = argv[++i] ?? "";
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  if (!input || !companyId) {
    throw new Error(
      "Usage: npx tsx scripts/import-support-gmail-once.ts --input <json> --company-id <id> [--dry-run]",
    );
  }
  return { input, companyId, dryRun };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { input, companyId, dryRun } = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(readFileSync(resolve(input), "utf8")) as ImportFile;
  if (!Array.isArray(payload.threads) || payload.threads.length === 0) {
    throw new Error("JSON.threads must be a non-empty array");
  }

  const db = getDatabase();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of payload.threads) {
    const gmailThreadId = String(item.gmailThreadId ?? "").trim();
    const rawEmail = String(item.rawEmail ?? "").trim();
    if (!gmailThreadId || !rawEmail) {
      console.warn("skip invalid thread entry", item.subject ?? "(no subject)");
      failed += 1;
      continue;
    }

    const existing = await findSupportThreadByGmailThreadId(
      db,
      companyId,
      gmailThreadId,
    );
    if (existing) {
      skipped += 1;
      console.log(`skip existing: ${existing.subject} (${gmailThreadId})`);
      continue;
    }

    try {
      const parsed = await parseSupportEmailWithLlm(rawEmail);
      if (dryRun) {
        console.log(
          `[dry-run] would create: ${parsed.subject} / ${parsed.category} / ${gmailThreadId}`,
        );
        created += 1;
        continue;
      }

      const thread = await createSupportThread(db, {
        companyId,
        subject: parsed.subject || item.subject || "無題の問い合わせ",
        category: parsed.category,
        status: parsed.status,
        questionSummary: parsed.questionSummary,
        answerSummary: parsed.answerSummary,
        background: parsed.background,
        conclusion: parsed.conclusion,
        rawEmail,
        sourceUrl: item.sourceUrl ?? null,
        gmailThreadId,
        tags: [...parsed.tags, "gmail-import"],
        freeeTargetKind: parsed.freeeTarget?.kind ?? null,
        freeeTargetId: parsed.freeeTarget?.id ?? null,
      });
      created += 1;
      console.log(`created: ${thread.subject} (${thread.id})`);
    } catch (error) {
      failed += 1;
      console.error(
        `failed: ${item.subject ?? gmailThreadId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(
    JSON.stringify({ created, skipped, failed, total: payload.threads.length }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
