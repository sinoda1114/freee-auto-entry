import { generateGeminiJson } from "./gemini";
import type { ConsultationTarget } from "./consultation-target";
import type { ConsultationContextBundle } from "@/lib/freee/consultation-data";

export type ConsultationLikelihood = "high" | "medium" | "low";

export interface ConsultationHypothesis {
  title: string;
  likelihood: ConsultationLikelihood;
  reasoning: string;
}

export interface AccountingConsultationReport {
  summary: string;
  facts: string[];
  hypotheses: ConsultationHypothesis[];
  checkpoints: string[];
  suggestions: string[];
}

interface RawConsultationReport {
  summary?: unknown;
  facts?: unknown;
  hypotheses?: unknown;
  checkpoints?: unknown;
  suggestions?: unknown;
}

interface RawHypothesis {
  title?: unknown;
  likelihood?: unknown;
  reasoning?: unknown;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One paragraph Japanese summary for the accountant.",
    },
    facts: {
      type: "array",
      items: { type: "string" },
      description: "Observed facts only. No speculation.",
    },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          likelihood: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          reasoning: { type: "string" },
        },
        required: ["title", "likelihood", "reasoning"],
      },
      description: "Ranked hypotheses explaining why the record looks this way.",
    },
    checkpoints: {
      type: "array",
      items: { type: "string" },
      description: "What the user should verify manually in freee.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description:
        "Possible fixes. Do not claim they were executed. Read-only advice only.",
    },
  },
  required: ["summary", "facts", "hypotheses", "checkpoints", "suggestions"],
} as const;

const LIKELIHOOD_LABELS: Record<ConsultationLikelihood, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function formatLikelihood(
  likelihood: ConsultationLikelihood,
): string {
  return LIKELIHOOD_LABELS[likelihood];
}

function parseLikelihood(value: unknown): ConsultationLikelihood | null {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateConsultationReport(
  raw: RawConsultationReport,
): AccountingConsultationReport | null {
  if (typeof raw.summary !== "string" || !raw.summary.trim()) {
    return null;
  }

  const hypotheses: ConsultationHypothesis[] = [];
  if (Array.isArray(raw.hypotheses)) {
    for (const item of raw.hypotheses) {
      const row = item as RawHypothesis;
      const likelihood = parseLikelihood(row.likelihood);
      if (
        typeof row.title !== "string" ||
        !row.title.trim() ||
        !likelihood ||
        typeof row.reasoning !== "string" ||
        !row.reasoning.trim()
      ) {
        continue;
      }
      hypotheses.push({
        title: row.title.trim(),
        likelihood,
        reasoning: row.reasoning.trim(),
      });
    }
  }

  return {
    summary: raw.summary.trim(),
    facts: parseStringArray(raw.facts),
    hypotheses,
    checkpoints: parseStringArray(raw.checkpoints),
    suggestions: parseStringArray(raw.suggestions),
  };
}

export function buildAccountingConsultationPrompt(input: {
  question: string;
  target: ConsultationTarget | null;
  context: ConsultationContextBundle;
  pagePath?: string;
}): string {
  const targetLine = input.context.targetLabel
    ? `Target: ${input.context.targetLabel}`
    : "Target: not specified (general consultation)";

  return [
    "You are a Japanese bookkeeping investigation assistant for freee accounting software.",
    "The user is trying to understand WHY an existing record looks the way it does.",
    "Think across related wallet transactions, transfers, and account types — not just the single record.",
    "Return JSON only.",
    "Never claim you changed freee data. This is read-only investigation.",
    "Separate facts from hypotheses clearly.",
    "If the record is a credit card wallet transaction registered as transfer to cash, explain why that is unusual.",
    "Prefer practical checkpoints the user can verify in freee UI.",
    "",
    `User question: ${input.question}`,
    targetLine,
    input.pagePath ? `Current app page: ${input.pagePath}` : "",
    `Investigation window: ${input.context.investigationWindow.startDate} to ${input.context.investigationWindow.endDate}`,
    "",
    "Primary record:",
    input.context.primaryRecord,
    "",
    "Related records:",
    input.context.relatedRecords.length
      ? input.context.relatedRecords.map((line) => `- ${line}`).join("\n")
      : "- none",
    "",
    "Walletables:",
    input.context.walletableDirectory.map((line) => `- ${line}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function consultAccountingWithLlm(input: {
  question: string;
  target: ConsultationTarget | null;
  context: ConsultationContextBundle;
  pagePath?: string;
}): Promise<AccountingConsultationReport> {
  const prompt = buildAccountingConsultationPrompt(input);
  const raw = await generateGeminiJson<RawConsultationReport>(
    prompt,
    RESPONSE_SCHEMA,
  );
  const report = validateConsultationReport(raw);
  if (!report) {
    throw new Error("AI相談の回答を整形できませんでした。");
  }
  return report;
}
