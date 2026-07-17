import { generateGeminiJson } from "./gemini";
import type { ConsultationTarget } from "./consultation-target";
import type { ConsultationContextBundle } from "@/lib/freee/consultation-data";
import type { ConsultationResponseMode } from "./consultation-intent";

export type ConsultationLikelihood = "high" | "medium" | "low";

export interface ConsultationHypothesis {
  title: string;
  likelihood: ConsultationLikelihood;
  reasoning: string;
}

export interface AccountingConsultationReport {
  mode: ConsultationResponseMode;
  summary: string;
  facts: string[];
  hypotheses: ConsultationHypothesis[];
  checkpoints: string[];
  suggestions: string[];
}

interface RawConsultationReport {
  mode?: unknown;
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
    mode: {
      type: "string",
      enum: ["present", "investigate"],
      description:
        "present = show numbers; investigate = why-analysis with hypotheses.",
    },
    summary: {
      type: "string",
      description: "Japanese summary matching the response mode.",
    },
    facts: {
      type: "array",
      items: { type: "string" },
      description:
        "For present: key account lines as '科目: 金額円'. For investigate: observed facts only.",
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
      description:
        "Only for investigate mode. Empty array for present mode unless user asked for analysis.",
    },
    checkpoints: {
      type: "array",
      items: { type: "string" },
      description: "Only for investigate mode. Empty for present.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "Only for investigate mode. Empty for present. Read-only advice.",
    },
  },
  required: ["mode", "summary", "facts", "hypotheses", "checkpoints", "suggestions"],
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

function parseMode(
  value: unknown,
  fallback: ConsultationResponseMode,
): ConsultationResponseMode {
  return value === "present" || value === "investigate" ? value : fallback;
}

export function validateConsultationReport(
  raw: RawConsultationReport,
  fallbackMode: ConsultationResponseMode = "investigate",
): AccountingConsultationReport | null {
  if (typeof raw.summary !== "string" || !raw.summary.trim()) {
    return null;
  }

  const mode = parseMode(raw.mode, fallbackMode);
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

  // present では調査枠を捨てる（モデルが余計に埋めても表示しない）
  if (mode === "present") {
    return {
      mode,
      summary: raw.summary.trim(),
      facts: parseStringArray(raw.facts),
      hypotheses: [],
      checkpoints: [],
      suggestions: [],
    };
  }

  return {
    mode,
    summary: raw.summary.trim(),
    facts: parseStringArray(raw.facts),
    hypotheses,
    checkpoints: parseStringArray(raw.checkpoints),
    suggestions: parseStringArray(raw.suggestions),
  };
}

function modeInstructions(mode: ConsultationResponseMode): string[] {
  if (mode === "present") {
    return [
      "RESPONSE MODE: present (display numbers — NOT investigation).",
      "The user asked to show / view a report. Match that request.",
      "- summary: 2–4 short Japanese sentences with period and headline totals (売上・販管費・利益など).",
      "- facts: list major account lines as '科目名: 金額円' (this IS the report body).",
      "- hypotheses, checkpoints, suggestions: MUST be empty arrays [].",
      "Do NOT invent anomalies, tax issues, cost-cut advice, or '修正案' unless the user asked for analysis.",
      "Do NOT use an investigation tone.",
    ];
  }
  return [
    "RESPONSE MODE: investigate (why-analysis).",
    "The user wants to understand WHY something looks wrong or unexpected.",
    "Separate facts from hypotheses clearly.",
    "Fill checkpoints the user can verify in freee UI, and suggestions as read-only advice.",
    "If the record is a credit card wallet transaction registered as transfer to cash, explain why that is unusual.",
  ];
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

  const reportSection = input.context.reportSummaries.length
    ? [
        "Report summaries (trial PL/BS from freee API — you DO have this data):",
        ...input.context.reportSummaries.map((line) => line),
      ]
    : [
        "Report summaries: not fetched for this question.",
        "If the user asks about P&L/BS and reports are missing, say the data was not loaded — do NOT claim you lack API permission.",
      ];

  return [
    "You are a Japanese bookkeeping assistant for freee accounting software.",
    "You can investigate specific records (deals, transfers, wallet transactions) AND present trial reports (損益計算書 / 貸借対照表) when provided below.",
    "You have read access via this app's freee API integration when Report summaries / Ledger sections are present.",
    "NEVER say you lack permission to view accounting data or cannot look at the P&L when report data is provided.",
    "If report data is absent, say it was not retrieved for this turn — not that you are forbidden.",
    "Return JSON only. Set mode to match the instructions below.",
    "Never claim you changed freee data. This is read-only.",
    "",
    ...modeInstructions(input.context.responseMode),
    "",
    `User question: ${input.question}`,
    targetLine,
    `Intent: ${input.context.intentKind}`,
    `Required mode field: ${input.context.responseMode}`,
    input.pagePath ? `Current app page: ${input.pagePath}` : "",
    `Investigation window: ${input.context.investigationWindow.startDate} to ${input.context.investigationWindow.endDate}`,
    input.context.fiscalYearLabel
      ? `Fiscal year: ${input.context.fiscalYearLabel}`
      : "Fiscal year: not resolved",
    input.context.dataFreshness
      ? `Data freshness: ${input.context.dataFreshness}`
      : "",
    "",
    "Primary record:",
    input.context.primaryRecord,
    "",
    "Related records:",
    input.context.relatedRecords.length
      ? input.context.relatedRecords.map((line) => `- ${line}`).join("\n")
      : "- none",
    "",
    ...reportSection,
    "",
    "Ledger:",
    input.context.ledgerSummary ?? "not fetched",
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
  const report = validateConsultationReport(raw, input.context.responseMode);
  if (!report) {
    throw new Error("AI相談の回答を整形できませんでした。");
  }
  // プロンプトの意図を優先（モデルが mode を誤っても present を守る）
  if (input.context.responseMode === "present" && report.mode !== "present") {
    return {
      ...report,
      mode: "present",
      hypotheses: [],
      checkpoints: [],
      suggestions: [],
    };
  }
  return report;
}
