import type { AccountItem, CreateDealInput } from "@/lib/freee/accounting";

/** freee の決済画面に出る「役員資金」。API では勘定科目「役員借入金」を private_account_item で渡す。 */
export const OFFICER_BORROWING_ACCOUNT_ITEM_NAME = "役員借入金";

export const OFFICER_FUNDS_MISSING_MESSAGE =
  "freeeに勘定科目「役員借入金」がないため、登録を止めています。役員資金での決済にこの科目を使います。";

type DealPayment = NonNullable<CreateDealInput["payment"]>;

export type OfficerFundsPaymentResult =
  | { ok: true; payment: DealPayment }
  | { ok: false; message: string };

export function resolveOfficerFundsPayment(
  accountItems: AccountItem[],
  date: string,
  amount: number,
): OfficerFundsPaymentResult {
  const found = accountItems.find(
    (item) => item.name.trim() === OFFICER_BORROWING_ACCOUNT_ITEM_NAME,
  );
  if (!found) {
    return { ok: false, message: OFFICER_FUNDS_MISSING_MESSAGE };
  }
  return {
    ok: true,
    payment: {
      date,
      amount,
      fromWalletableType: "private_account_item",
      fromWalletableId: found.id,
    },
  };
}
