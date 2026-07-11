import { AuthGate } from "@/app/components/AuthGate";
import { getAccountItems, getTaxCodes } from "@/lib/freee/accounting";
import { isExpenseCompany } from "@/lib/freee/company-policy";
import {
  getConnectedCompanies,
  getValidFreeeAuth,
} from "@/lib/freee/session-client";
import { ExpenseBlockedView, ExpensePageView } from "./ExpensePageView";

export default async function NewExpensePage() {
  const auth = await getValidFreeeAuth();

  if (!auth) {
    return (
      <AuthGate
        title="経費を登録"
        description="freeeとの連携が切れています。もう一度ログインしてください。"
      />
    );
  }

  if (!isExpenseCompany(auth.companyId)) {
    const { companies } = await getConnectedCompanies();
    const expenseCompany = companies.find((company) =>
      isExpenseCompany(company.companyId),
    );

    return (
      <ExpenseBlockedView expenseCompanyName={expenseCompany?.companyName} />
    );
  }

  const [accountItems, taxCodes] = await Promise.all([
    getAccountItems(auth),
    getTaxCodes(auth),
  ]);

  return <ExpensePageView accountItems={accountItems} taxCodes={taxCodes} />;
}
