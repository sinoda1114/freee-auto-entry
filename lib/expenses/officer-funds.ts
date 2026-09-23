import type { Walletable, WalletableAccountType } from "@/lib/freee/accounting";

export const OFFICER_FUNDS_WALLETABLE_NAME = "役員資金";

export type OfficerFundsLookup =
  | {
      status: "found";
      id: number;
      type: WalletableAccountType;
    }
  | { status: "missing" }
  | { status: "untyped" };

function isWalletableAccountType(
  value: Walletable["type"],
): value is WalletableAccountType {
  return (
    value === "bank_account" || value === "credit_card" || value === "wallet"
  );
}

export function findOfficerFundsWalletable(
  walletables: Walletable[],
): OfficerFundsLookup {
  const found = walletables.find(
    (item) => item.name.trim() === OFFICER_FUNDS_WALLETABLE_NAME,
  );
  if (!found) {
    return { status: "missing" };
  }
  if (!isWalletableAccountType(found.type)) {
    return { status: "untyped" };
  }
  return { status: "found", id: found.id, type: found.type };
}
