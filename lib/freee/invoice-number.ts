/** Traditional freee-style number: `{prefix}{YYMM}` e.g. `0062507`, optional `-2` branch. */
const TRADITIONAL_NUMBER_PATTERN = /^(\d{3})(\d{4})(?:-(\d+))?$/;

export type InvoiceNumberHint = {
  partnerId: number;
  subject: string;
  invoiceNumber: string;
  billingDate?: string;
};

export function parseTraditionalInvoiceNumber(
  invoiceNumber: string,
): { prefix: string; yymm: string; branch: number } | null {
  const match = invoiceNumber.trim().match(TRADITIONAL_NUMBER_PATTERN);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    prefix: match[1],
    yymm: match[2],
    branch: match[3] ? Number(match[3]) : 1,
  };
}

/** Billing date `YYYY-MM-DD` → `YYMM`. */
export function invoiceYyMmFromBillingDate(billingDate: string): string {
  return `${billingDate.slice(2, 4)}${billingDate.slice(5, 7)}`;
}

/**
 * Prefer 「N月分」 in the subject for the month; year follows billing date
 * (and rolls back when 12月分 is billed in Jan/Feb).
 */
export function invoiceYyMmFromSubjectAndBilling(
  subject: string,
  billingDate: string,
): string {
  const monthMatch = subject.match(/(\d{1,2})\s*月分/);
  if (!monthMatch?.[1]) {
    return invoiceYyMmFromBillingDate(billingDate);
  }
  const month = Number(monthMatch[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return invoiceYyMmFromBillingDate(billingDate);
  }
  let year = Number(billingDate.slice(0, 4));
  const billingMonth = Number(billingDate.slice(5, 7));
  if (billingMonth <= 2 && month >= 11) {
    year -= 1;
  }
  return `${String(year).slice(2)}${String(month).padStart(2, "0")}`;
}

function subjectTokens(subject: string): string[] {
  return subject
    .toLowerCase()
    .replace(/[0-9０-９]+\s*月分/g, " ")
    .replace(/[／/\-_|]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function subjectOverlapScore(left: string, right: string): number {
  const a = new Set(subjectTokens(left));
  const b = subjectTokens(right);
  if (a.size === 0 || b.length === 0) {
    return 0;
  }
  let hit = 0;
  for (const token of b) {
    if (a.has(token)) {
      hit += 1;
    }
  }
  return hit;
}

/** Pick a 3-digit project code from past traditional numbers. */
export function inferInvoiceNumberPrefix(
  input: {
    partnerId: number;
    subject?: string;
    hints: InvoiceNumberHint[];
  },
): string | null {
  const traditional = input.hints
    .map((hint) => {
      const parsed = parseTraditionalInvoiceNumber(hint.invoiceNumber);
      if (!parsed) {
        return null;
      }
      return { hint, parsed };
    })
    .filter((row): row is { hint: InvoiceNumberHint; parsed: NonNullable<ReturnType<typeof parseTraditionalInvoiceNumber>> } =>
      Boolean(row),
    );

  if (traditional.length === 0) {
    return null;
  }

  const samePartner = traditional.filter(
    (row) => row.hint.partnerId === input.partnerId,
  );
  const pool = samePartner.length > 0 ? samePartner : traditional;
  const subject = input.subject?.trim() ?? "";

  if (subject) {
    const scored = pool
      .map((row) => ({
        prefix: row.parsed.prefix,
        score: subjectOverlapScore(subject, row.hint.subject),
        billingDate: row.hint.billingDate ?? "",
      }))
      .filter((row) => row.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.billingDate.localeCompare(left.billingDate);
      });
    if (scored[0]) {
      return scored[0].prefix;
    }
  }

  const latest = [...pool].sort((left, right) =>
    (right.hint.billingDate ?? "").localeCompare(left.hint.billingDate ?? ""),
  )[0];
  return latest?.parsed.prefix ?? null;
}

/** Next unused 3-digit prefix among traditional numbers (001–998). */
export function allocateNextInvoiceNumberPrefix(
  existingNumbers: string[],
): string {
  let max = 0;
  for (const number of existingNumbers) {
    const parsed = parseTraditionalInvoiceNumber(number);
    if (!parsed) {
      continue;
    }
    const value = Number(parsed.prefix);
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  const next = Math.min(998, Math.max(1, max + 1));
  return String(next).padStart(3, "0");
}

export function allocateUniqueTraditionalInvoiceNumber(input: {
  prefix: string;
  yymm: string;
  existingNumbers: string[];
}): string {
  const existing = new Set(
    input.existingNumbers.map((number) => number.trim()),
  );
  const base = `${input.prefix}${input.yymm}`;
  if (!existing.has(base)) {
    return base;
  }
  for (let branch = 2; branch <= 99; branch += 1) {
    const candidate = `${base}-${branch}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36).slice(-3)}`;
}

/**
 * Generate a traditional-style invoice number when freee auto-numbering is off.
 * Example: `0062608` (prefix 006 + Aug 2026).
 */
export function generateInvoiceNumber(input: {
  billingDate: string;
  partnerId: number;
  subject?: string;
  prefix?: string;
  existingNumbers?: string[];
  hints?: InvoiceNumberHint[];
}): string {
  const existingNumbers = input.existingNumbers ?? [];
  const hints = input.hints ?? [];
  const prefix =
    input.prefix?.replace(/\D/g, "").slice(0, 3).padStart(3, "0") ||
    inferInvoiceNumberPrefix({
      partnerId: input.partnerId,
      subject: input.subject,
      hints,
    }) ||
    allocateNextInvoiceNumberPrefix(existingNumbers);

  const yymm = invoiceYyMmFromSubjectAndBilling(
    input.subject ?? "",
    input.billingDate,
  );

  return allocateUniqueTraditionalInvoiceNumber({
    prefix,
    yymm,
    existingNumbers,
  });
}

export function isInvoiceNumberRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("invoice_number") &&
    (error.message.includes("必須") ||
      error.message.includes("自動採番が無効"))
  );
}

/** Auto-numbering is ON — freee rejects a client-supplied invoice_number. */
export function isInvoiceNumberForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("invoice_number") &&
    (error.message.includes("指定できません") ||
      error.message.includes("自動採番する"))
  );
}
