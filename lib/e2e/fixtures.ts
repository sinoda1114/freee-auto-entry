import type { AccountItem, TaxCode, Walletable } from "@/lib/freee/accounting";
import type { InvoiceSummary } from "@/lib/freee/invoice";
import type { UserMatcher, WalletTransaction } from "@/lib/freee/wallet";

export function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === "1";
}

export const e2eWalletTransactions: WalletTransaction[] = [
  {
    id: 101,
    companyId: "11122591",
    date: "2026-07-01",
    amount: -260,
    dueAmount: -260,
    entrySide: "expense",
    walletableType: "credit_card",
    walletableId: 20,
    description: "Microsoft 365",
    status: 1,
    ruleMatched: false,
  },
  {
    id: 102,
    companyId: "11122591",
    date: "2026-07-02",
    amount: -980,
    dueAmount: -980,
    entrySide: "expense",
    walletableType: "credit_card",
    walletableId: 20,
    description: "DAZN サブスク",
    status: 1,
    ruleMatched: false,
  },
  {
    id: 103,
    companyId: "11122591",
    date: "2026-07-03",
    amount: 50000,
    dueAmount: 50000,
    entrySide: "income",
    walletableType: "bank_account",
    walletableId: 10,
    description: "振込 カ）ABC",
    status: 1,
    ruleMatched: false,
  },
];

export const e2eUserMatchers: UserMatcher[] = [
  {
    id: 9,
    entrySide: "expense",
    description: "Microsoft 365",
    condition: 3,
    priority: 1,
    act: 1,
    active: true,
    accountItemName: "通信費",
    taxName: "課対仕入10%",
  },
  {
    id: 10,
    entrySide: "expense",
    description: "Amazon",
    condition: 0,
    priority: 2,
    act: 0,
    active: true,
    accountItemName: "消耗品費",
    taxName: "課対仕入10%",
  },
  {
    id: 11,
    entrySide: "income",
    description: "振込 カ）ABC",
    condition: 3,
    priority: 1,
    act: 1,
    active: true,
    accountItemName: "売上高",
    taxName: "課税売上10%",
  },
];

export function mutateE2EUserMatcher(updated: UserMatcher): void {
  const index = e2eUserMatchers.findIndex((m) => m.id === updated.id);
  if (index !== -1) {
    e2eUserMatchers[index] = updated;
  }
}

export const e2eAccountItems: AccountItem[] = [
  { id: 1, name: "通信費", defaultTaxCode: 136 },
  { id: 2, name: "消耗品費", defaultTaxCode: 136 },
  { id: 3, name: "売上高", defaultTaxCode: 129 },
];

export const e2eTaxCodes: TaxCode[] = [
  { code: 136, name: "課対仕入10%" },
  { code: 129, name: "課税売上10%" },
];

export const e2eWalletables: Walletable[] = [
  { id: 10, name: "メイン口座" },
  { id: 20, name: "法人カード" },
];

export const e2eInvoiceSummaries: InvoiceSummary[] = [
  {
    id: 2001,
    companyId: "11122591",
    invoiceNumber: "INV-2026-001",
    subject: "7月分 サービス費用",
    billingDate: "2026-07-01",
    sendingStatus: "unsent",
    paymentStatus: "unsettled",
    totalAmount: 110000,
    partnerId: 1,
    partnerName: "株式会社サンプル",
    reportUrl: "https://invoice.freee.co.jp/download/2001",
  },
];
