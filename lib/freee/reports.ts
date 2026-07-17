import type { FreeeAuth } from "./accounting";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface TrialBalanceLine {
  accountItemName: string;
  hierarchyLevel: number | null;
  parentAccountCategoryName: string | null;
  closingBalance: number;
  compositionRatio: number | null;
}

export interface TrialReport {
  kind: "pl" | "bs";
  startDate: string | null;
  endDate: string | null;
  fiscalYear: number | null;
  upToDate: boolean;
  upToDateReasons: string[];
  balances: TrialBalanceLine[];
}

export interface GeneralLedgerLine {
  accountItemId: number | null;
  accountItemName: string;
  totalAmount: number | null;
  finalBalance: number | null;
  debitAmount: number | null;
  creditAmount: number | null;
}

export interface TrialPeriodParams {
  fiscalYear?: number;
  startDate?: string;
  endDate?: string;
}

export interface SummarizedTrialBalances {
  lines: string[];
  omittedCount: number;
}

async function freeeFetch(auth: FreeeAuth, path: string): Promise<unknown> {
  const res = await fetch(`${ACCOUNTING_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee accounting API request failed: ${res.status} ${text}`);
  }
  return res.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseBalanceLine(value: unknown): TrialBalanceLine | null {
  if (!isRecord(value)) {
    return null;
  }
  const name =
    asString(value.account_item_name) ?? asString(value.account_category_name);
  const closing = asNumber(value.closing_balance);
  if (!name || closing === null) {
    return null;
  }
  return {
    accountItemName: name,
    hierarchyLevel: asNumber(value.hierarchy_level),
    parentAccountCategoryName: asString(value.parent_account_category_name),
    closingBalance: closing,
    compositionRatio: asNumber(value.composition_ratio),
  };
}

function buildPeriodQuery(params: TrialPeriodParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.startDate && params.endDate) {
    query.set("start_date", params.startDate);
    query.set("end_date", params.endDate);
    return query;
  }
  if (typeof params.fiscalYear === "number") {
    query.set("fiscal_year", String(params.fiscalYear));
  }
  return query;
}

function parseTrialReport(
  kind: "pl" | "bs",
  payloadKey: "trial_pl" | "trial_bs",
  data: unknown,
): TrialReport {
  if (!isRecord(data) || !isRecord(data[payloadKey])) {
    throw new Error(`freee ${payloadKey} response is invalid`);
  }
  const report = data[payloadKey] as Record<string, unknown>;
  const balancesRaw = Array.isArray(report.balances) ? report.balances : [];
  const balances = balancesRaw
    .map(parseBalanceLine)
    .filter((line): line is TrialBalanceLine => line !== null);

  const reasonsRaw = Array.isArray(data.up_to_date_reasons)
    ? data.up_to_date_reasons
    : [];
  const upToDateReasons = reasonsRaw
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      return asString(item.message);
    })
    .filter((item): item is string => item !== null);

  return {
    kind,
    startDate: asString(report.start_date),
    endDate: asString(report.end_date),
    fiscalYear: asNumber(report.fiscal_year),
    upToDate: data.up_to_date === true,
    upToDateReasons,
    balances,
  };
}

const e2ePl: TrialReport = {
  kind: "pl",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  fiscalYear: 2025,
  upToDate: true,
  upToDateReasons: [],
  balances: [
    {
      accountItemName: "売上高",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 12_000_000,
      compositionRatio: 100,
    },
    {
      accountItemName: "売上原価",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 4_000_000,
      compositionRatio: 33.3,
    },
    {
      accountItemName: "販売費及び一般管理費",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 3_500_000,
      compositionRatio: 29.2,
    },
    {
      accountItemName: "当期純利益",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 2_200_000,
      compositionRatio: 18.3,
    },
  ],
};

const e2eBs: TrialReport = {
  kind: "bs",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  fiscalYear: 2025,
  upToDate: true,
  upToDateReasons: [],
  balances: [
    {
      accountItemName: "資産の部",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 8_000_000,
      compositionRatio: 100,
    },
    {
      accountItemName: "現金及び預金",
      hierarchyLevel: 2,
      parentAccountCategoryName: "資産の部",
      closingBalance: 3_000_000,
      compositionRatio: 37.5,
    },
    {
      accountItemName: "負債の部",
      hierarchyLevel: 1,
      parentAccountCategoryName: null,
      closingBalance: 2_500_000,
      compositionRatio: 31.3,
    },
  ],
};

export async function getTrialPl(
  auth: FreeeAuth,
  params: TrialPeriodParams = {},
): Promise<TrialReport> {
  if (isE2ETestMode()) {
    return e2ePl;
  }
  const query = buildPeriodQuery(params);
  query.set("company_id", auth.companyId);
  query.set("account_item_display_type", "group");
  const data = await freeeFetch(auth, `/reports/trial_pl?${query.toString()}`);
  return parseTrialReport("pl", "trial_pl", data);
}

export async function getTrialBs(
  auth: FreeeAuth,
  params: TrialPeriodParams = {},
): Promise<TrialReport> {
  if (isE2ETestMode()) {
    return e2eBs;
  }
  const query = buildPeriodQuery(params);
  query.set("company_id", auth.companyId);
  query.set("account_item_display_type", "group");
  const data = await freeeFetch(auth, `/reports/trial_bs?${query.toString()}`);
  return parseTrialReport("bs", "trial_bs", data);
}

export async function getGeneralLedgers(
  auth: FreeeAuth,
  input: {
    startDate: string;
    endDate: string;
    accountItemName?: string;
  },
): Promise<GeneralLedgerLine[]> {
  if (isE2ETestMode()) {
    return [
      {
        accountItemId: 1,
        accountItemName: input.accountItemName ?? "売上高",
        totalAmount: 12_000_000,
        finalBalance: 12_000_000,
        debitAmount: 0,
        creditAmount: 12_000_000,
      },
    ];
  }
  const query = new URLSearchParams({
    company_id: auth.companyId,
    start_date: input.startDate,
    end_date: input.endDate,
  });
  if (input.accountItemName) {
    query.set("account_item_name", input.accountItemName);
  }
  const data = await freeeFetch(
    auth,
    `/reports/general_ledgers?${query.toString()}`,
  );
  if (!isRecord(data) || !Array.isArray(data.general_ledgers)) {
    throw new Error("freee general_ledgers response is invalid");
  }
  return data.general_ledgers
    .map((row): GeneralLedgerLine | null => {
      if (!isRecord(row)) {
        return null;
      }
      const name = asString(row.account_item_name);
      if (!name) {
        return null;
      }
      return {
        accountItemId: asNumber(row.account_item_id),
        accountItemName: name,
        totalAmount: asNumber(row.total_amount),
        finalBalance: asNumber(row.final_balance),
        debitAmount: asNumber(row.debit_amount),
        creditAmount: asNumber(row.credit_amount),
      };
    })
    .filter((line): line is GeneralLedgerLine => line !== null);
}

/** LLM 向けに試算表行を圧縮する（ゼロ行除去・上位N・浅い階層優先） */
export function summarizeTrialBalances(
  balances: TrialBalanceLine[],
  limit = 40,
): SummarizedTrialBalances {
  const nonZero = balances.filter((line) => line.closingBalance !== 0);
  const shallow = nonZero.filter(
    (line) => line.hierarchyLevel === null || line.hierarchyLevel <= 2,
  );
  const pool = shallow.length > 0 ? shallow : nonZero;
  const ranked = [...pool].sort(
    (a, b) => Math.abs(b.closingBalance) - Math.abs(a.closingBalance),
  );
  const selected = ranked.slice(0, limit);
  const lines = selected.map((line) => {
    const parts = [
      line.accountItemName,
      `${line.closingBalance.toLocaleString("ja-JP")}円`,
    ];
    if (line.compositionRatio !== null) {
      parts.push(`構成比${line.compositionRatio}%`);
    }
    if (line.parentAccountCategoryName) {
      parts.push(`上位:${line.parentAccountCategoryName}`);
    }
    if (line.hierarchyLevel !== null) {
      parts.push(`階層${line.hierarchyLevel}`);
    }
    return parts.join(" / ");
  });
  return {
    lines,
    omittedCount: Math.max(0, nonZero.length - selected.length),
  };
}

export function formatTrialReportForPrompt(
  label: string,
  report: TrialReport,
  limit = 40,
): string {
  const summary = summarizeTrialBalances(report.balances, limit);
  const period =
    report.startDate && report.endDate
      ? `${report.startDate}〜${report.endDate}`
      : report.fiscalYear
        ? `FY${report.fiscalYear}`
        : "期間不明";
  const freshness = report.upToDate
    ? "集計は最新"
    : `集計は未完了の可能性あり${
        report.upToDateReasons.length
          ? `（${report.upToDateReasons.join("; ")}）`
          : ""
      }`;
  const body = summary.lines.length
    ? summary.lines.map((line) => `  - ${line}`).join("\n")
    : "  - （金額のある行なし）";
  const omitted =
    summary.omittedCount > 0
      ? `\n  - （他 ${summary.omittedCount} 行を省略）`
      : "";
  return `${label}（${period} / ${freshness}）:\n${body}${omitted}`;
}

export function formatGeneralLedgersForPrompt(
  ledgers: GeneralLedgerLine[],
  limit = 20,
): string {
  if (ledgers.length === 0) {
    return "総勘定元帳: 該当なし";
  }
  const ranked = [...ledgers].sort(
    (a, b) =>
      Math.abs(b.finalBalance ?? b.totalAmount ?? 0) -
      Math.abs(a.finalBalance ?? a.totalAmount ?? 0),
  );
  const selected = ranked.slice(0, limit);
  const lines = selected.map((line) => {
    const balance = line.finalBalance ?? line.totalAmount;
    return `  - ${line.accountItemName} / 残高${
      balance !== null ? `${balance.toLocaleString("ja-JP")}円` : "不明"
    }`;
  });
  const omitted =
    ledgers.length > selected.length
      ? `\n  - （他 ${ledgers.length - selected.length} 科目を省略）`
      : "";
  return `総勘定元帳:\n${lines.join("\n")}${omitted}`;
}
