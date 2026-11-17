import { AuthGate } from "@/app/components/AuthGate";
import {
  getAccountItems,
  getTaxCodes,
  type AccountItem,
  type FreeeAuth,
} from "@/lib/freee/accounting";
import { isExpenseCompany } from "@/lib/freee/company-policy";
import { listRecentRegisteredExpenses } from "@/lib/freee/recent-expenses";
import {
  getConnectedCompanies,
  getValidFreeeAuth,
} from "@/lib/freee/session-client";
import {
  ExpenseBlockedView,
  ExpensePageView,
  type RecentExpensesLoad,
} from "./ExpensePageView";

function loadRecentExpenses(
  auth: FreeeAuth,
  accountItems: AccountItem[],
): Promise<RecentExpensesLoad> {
  return listRecentRegisteredExpenses(auth, accountItems).then(
    (rows) => ({ rows, unavailable: false }),
    () => ({ rows: [], unavailable: true }),
  );
}

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

  return (
    <ExpensePageView
      companyId={auth.companyId}
      accountItems={accountItems}
      taxCodes={taxCodes}
      recentExpenses={loadRecentExpenses(auth, accountItems)}
    />
  );
}
