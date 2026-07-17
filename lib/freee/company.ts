import type { FreeeAuth } from "@/lib/freee/accounting";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface FreeeCompany {
  id: number;
  name: string;
  displayName: string | null;
}

export interface FiscalYear {
  id: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  /** 経理方式: 0=税込経理, 1=税抜経理（freee API） */
  taxAccountMethod: number | null;
  /** 課税方式コード（freee API の tax_method。詳細ラベルは mapTaxMethodLabel） */
  taxMethod: number | null;
}

export function mapTaxAccountMethodLabel(code: number | null): string {
  if (code === 0) return "税込経理";
  if (code === 1) return "税抜経理";
  if (code === null) return "不明";
  return `不明（コード${code}）`;
}

/** tax_method は環境により意味が揺れるためコードのみ返す */
export function mapTaxMethodLabel(code: number | null): string {
  if (code === null) return "不明";
  return `コード${code}`;
}

export interface RegistrableDateRange {
  startDate: string;
  endDate: string;
}

interface RawCompany {
  id: number;
  name: string;
  display_name: string | null;
}

interface RawFiscalYear {
  id: number;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  tax_account_method?: unknown;
  tax_method?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRawCompany(value: unknown): value is RawCompany {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    (typeof value.display_name === "string" || value.display_name === null)
  );
}

function isRawFiscalYear(value: unknown): value is RawFiscalYear {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.start_date === "string" &&
    typeof value.end_date === "string" &&
    typeof value.is_closed === "boolean"
  );
}

/**
 * ログインユーザーが所属する事業所一覧を取得する。
 * (GET /api/1/companies)
 */
export async function getCompanies(accessToken: string): Promise<FreeeCompany[]> {
  const res = await fetch(`${ACCOUNTING_API_BASE}/companies`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee companies API request failed: ${res.status} ${text}`);
  }

  const data: unknown = await res.json();
  if (
    !isRecord(data) ||
    !Array.isArray(data.companies) ||
    !data.companies.every(isRawCompany)
  ) {
    throw new Error("freee companies API response is invalid");
  }

  return data.companies.map((company) => ({
    id: company.id,
    name: company.name,
    displayName: company.display_name,
  }));
}

/**
 * 事業所詳細から会計年度一覧を取得する。
 * (GET /api/1/companies/{id})
 */
export async function getCompanyFiscalYears(
  auth: FreeeAuth,
): Promise<FiscalYear[]> {
  const res = await fetch(
    `${ACCOUNTING_API_BASE}/companies/${auth.companyId}`,
    {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `freee company detail API request failed: ${res.status} ${text}`,
    );
  }

  const data: unknown = await res.json();
  if (
    !isRecord(data) ||
    !isRecord(data.company) ||
    !Array.isArray(data.company.fiscal_years) ||
    !data.company.fiscal_years.every(isRawFiscalYear)
  ) {
    throw new Error("freee company detail API response is invalid");
  }

  return data.company.fiscal_years.map((fy) => ({
    id: fy.id,
    startDate: fy.start_date,
    endDate: fy.end_date,
    isClosed: fy.is_closed,
    taxAccountMethod:
      typeof fy.tax_account_method === "number" ? fy.tax_account_method : null,
    taxMethod: typeof fy.tax_method === "number" ? fy.tax_method : null,
  }));
}

/** 取引登録可能な会計年度の日付範囲（未締め優先、当日を含む年度を優先） */
export function resolveRegistrableDateRange(
  fiscalYears: FiscalYear[],
  todayIsoDate: string = new Date().toISOString().slice(0, 10),
): RegistrableDateRange | null {
  if (fiscalYears.length === 0) return null;

  const openYears = fiscalYears.filter((fy) => !fy.isClosed);
  const pool = openYears.length > 0 ? openYears : fiscalYears;

  const containing = pool.find(
    (fy) => fy.startDate <= todayIsoDate && fy.endDate >= todayIsoDate,
  );
  const selected =
    containing ??
    [...pool].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  if (!selected) return null;
  return { startDate: selected.startDate, endDate: selected.endDate };
}

export function isDateInRegistrableRange(
  date: string,
  range: RegistrableDateRange | null,
): boolean {
  if (!range) return true;
  return date >= range.startDate && date <= range.endDate;
}

/** freee の期首エラーなどをユーザー向けに短くする */
export function formatDealCreateError(raw: string): string {
  if (raw.includes("期首日以前")) {
    return "会計年度の期首より前の日付は登録できません。期首日以降の明細だけ選んでください。";
  }
  if (raw.includes("期末日") || raw.includes("会計期間外")) {
    return "会計年度の範囲外の日付は登録できません。対象年度内の明細だけ選んでください。";
  }
  return raw;
}
