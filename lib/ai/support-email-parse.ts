import { generateGeminiJson } from "./gemini";
import {
  parseConsultationTarget,
  type ConsultationTarget,
} from "./consultation-target";
import type {
  SupportThreadCategory,
  SupportThreadStatus,
} from "@/lib/db/support-threads";
import {
  isSupportThreadCategory,
  SUPPORT_THREAD_CATEGORY_VALUES,
} from "@/lib/support/categories";

export interface ParsedSupportEmail {
  subject: string;
  category: SupportThreadCategory;
  status: SupportThreadStatus;
  questionSummary: string;
  answerSummary: string;
  background: string;
  conclusion: string;
  tags: string[];
  freeeTarget: ConsultationTarget | null;
}

interface RawParsedSupportEmail {
  subject?: unknown;
  category?: unknown;
  status?: unknown;
  questionSummary?: unknown;
  answerSummary?: unknown;
  background?: unknown;
  conclusion?: unknown;
  tags?: unknown;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description: "Short Japanese subject summarizing the inquiry",
    },
    category: {
      type: "string",
      enum: SUPPORT_THREAD_CATEGORY_VALUES,
    },
    status: {
      type: "string",
      enum: ["open", "resolved", "follow_up"],
    },
    questionSummary: {
      type: "string",
      description: "User question summarized in 1-2 Japanese sentences",
    },
    answerSummary: {
      type: "string",
      description: "Support answer summarized in Japanese. Empty if unanswered.",
    },
    background: {
      type: "string",
      description: "Relevant background / symptoms from the email",
    },
    conclusion: {
      type: "string",
      description: "Actionable conclusion. Empty if unclear.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Short Japanese tags without #",
    },
  },
  required: [
    "subject",
    "category",
    "status",
    "questionSummary",
    "answerSummary",
    "background",
    "conclusion",
    "tags",
  ],
} as const;

function isStatus(value: unknown): value is SupportThreadStatus {
  return value === "open" || value === "resolved" || value === "follow_up";
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 12);
}

export function validateParsedSupportEmail(
  raw: RawParsedSupportEmail,
  freeeTarget: ConsultationTarget | null,
): ParsedSupportEmail | null {
  if (
    typeof raw.subject !== "string" ||
    !raw.subject.trim() ||
    typeof raw.questionSummary !== "string" ||
    !raw.questionSummary.trim() ||
    !isSupportThreadCategory(raw.category) ||
    !isStatus(raw.status)
  ) {
    return null;
  }

  return {
    subject: raw.subject.trim(),
    category: raw.category,
    status: raw.status,
    questionSummary: raw.questionSummary.trim(),
    answerSummary:
      typeof raw.answerSummary === "string" ? raw.answerSummary.trim() : "",
    background: typeof raw.background === "string" ? raw.background.trim() : "",
    conclusion: typeof raw.conclusion === "string" ? raw.conclusion.trim() : "",
    tags: parseStringArray(raw.tags),
    freeeTarget,
  };
}

export function buildSupportEmailParsePrompt(rawEmail: string): string {
  return [
    "You structure freee support email threads for a personal knowledge base.",
    "Return JSON only. Write all text fields in Japanese.",
    "Prefer concise, searchable summaries.",
    "If the support answer is missing, leave answerSummary and conclusion empty and set status=open.",
    "If answered clearly, prefer status=resolved.",
    "If answered but follow-up remains, use status=follow_up.",
    "category tips:",
    "- accounting: freee Accounting, expenses, receipts, bank/card transactions, transfers",
    "- hr: freee HR, attendance, payroll, employees",
    "- invoice: freee Invoices, quotations, billing",
    "- project_management: freee Project Management and workloads",
    "- sales_management: freee Sales Management",
    "- it_management: freee IT Management, SaaS accounts and assets",
    "- sign: freee Sign and electronic contracts",
    "- api: API, external integrations and OAuth",
    "- other: everything else",
    "",
    "Email body:",
    rawEmail,
  ].join("\n");
}

export function fallbackParsedSupportEmail(
  rawEmail: string,
  freeeTarget: ConsultationTarget | null,
): ParsedSupportEmail {
  const firstLine =
    rawEmail
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "freeeサポート問い合わせ";
  return {
    subject: firstLine.slice(0, 80),
    category:
      freeeTarget?.kind === "wallet_txn" ||
      freeeTarget?.kind === "transfer" ||
      freeeTarget?.kind === "deal"
        ? "accounting"
        : "other",
    status: "open",
    questionSummary: firstLine.slice(0, 200),
    answerSummary: "",
    background: "",
    conclusion: "",
    tags: [],
    freeeTarget,
  };
}

export async function parseSupportEmailWithLlm(
  rawEmail: string,
): Promise<ParsedSupportEmail> {
  const trimmed = rawEmail.trim();
  if (!trimmed) {
    throw new Error("メール本文が空です。");
  }

  const freeeTarget = parseConsultationTarget(trimmed);

  try {
    const raw = await generateGeminiJson<RawParsedSupportEmail>(
      buildSupportEmailParsePrompt(trimmed),
      RESPONSE_SCHEMA,
    );
    const parsed = validateParsedSupportEmail(raw, freeeTarget);
    if (!parsed) {
      return fallbackParsedSupportEmail(trimmed, freeeTarget);
    }
    return parsed;
  } catch {
    return fallbackParsedSupportEmail(trimmed, freeeTarget);
  }
}
