/**
 * Local smoke: resolve consultation model for sample questions.
 * Usage: npx tsx scripts/try-consultation-model-route.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx);
    let value = trimmed.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();
  const { resolveConsultationModel, logConsultationModelRoute } = await import(
    "../lib/ai/consultation-model-route"
  );

  const questions = [
    "損益計算書を表示して",
    "なぜこの振替が現金になっている？",
    "一般課税と簡易課税どっちが得？",
  ];

  for (const question of questions) {
    const started = Date.now();
    const result = await resolveConsultationModel({ question });
    logConsultationModelRoute(result, question);
    console.log(
      JSON.stringify(
        {
          question,
          ...result,
          ms: Date.now() - started,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
