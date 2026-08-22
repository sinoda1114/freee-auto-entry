/** 経費登録を許可する事業所（未設定時: ワールスフォース + 篠田 ITサービス） */
const DEFAULT_EXPENSE_COMPANY_IDS = ["11122591", "11040830"] as const;

function parseExpenseCompanyIds(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [...DEFAULT_EXPENSE_COMPANY_IDS];
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** 経費登録を許可する事業所 ID 一覧 */
export function getExpenseCompanyIds(): string[] {
  return parseExpenseCompanyIds(
    process.env.FREEE_EXPENSE_COMPANY_IDS ??
      process.env.FREEE_EXPENSE_COMPANY_ID,
  );
}

/** @deprecated 複数事業所対応後は getExpenseCompanyIds を使う */
export function getExpenseCompanyId(): string {
  return getExpenseCompanyIds()[0] ?? DEFAULT_EXPENSE_COMPANY_IDS[0];
}

export function isExpenseCompany(companyId: string): boolean {
  return getExpenseCompanyIds().includes(String(companyId));
}
