/** 経費登録を許可する事業所 ID（未設定時はワールスフォース） */
export function getExpenseCompanyId(): string {
  return process.env.FREEE_EXPENSE_COMPANY_ID ?? "11122591";
}

export function isExpenseCompany(companyId: string): boolean {
  return String(companyId) === getExpenseCompanyId();
}
