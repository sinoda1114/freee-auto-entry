import {
  e2eAccountItems,
  e2eTaxCodes,
  e2eWalletables,
  isE2ETestMode,
} from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface FreeeAuth {
  accessToken: string;
  companyId: string;
}

export interface AccountItem {
  id: number;
  name: string;
  defaultTaxCode: number;
}

export interface TaxCode {
  code: number;
  name: string;
}

export interface Walletable {
  id: number;
  name: string;
}

export interface Partner {
  id: number;
  name: string;
}

export interface CreatedDeal {
  id: number;
}

export interface CreateDealInput {
  issueDate: string;
  accountItemId: number;
  taxCode: number;
  amount: number;
  description: string;
  memoTagIds?: number[];
  receiptIds?: number[];
}

async function freeeFetch(auth: FreeeAuth, path: string, init: RequestInit = {}) {
  const res = await fetch(`${ACCOUNTING_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee accounting API request failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getAccountItems(auth: FreeeAuth): Promise<AccountItem[]> {
  if (isE2ETestMode()) {
    return e2eAccountItems;
  }
  const data = await freeeFetch(
    auth,
    `/account_items?company_id=${auth.companyId}`,
  );
  return (data.account_items as Array<Record<string, unknown>>)
    .filter((item) => item.available !== false)
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name),
      defaultTaxCode: Number(item.default_tax_code),
    }));
}

export function resolveTaxNameForAccountItem(
  accountItemName: string,
  accountItems: AccountItem[],
  taxCodes: TaxCode[],
): string | undefined {
  const accountItem = accountItems.find((item) => item.name === accountItemName);
  if (!accountItem) {
    return undefined;
  }
  return taxCodes.find((tax) => tax.code === accountItem.defaultTaxCode)?.name;
}

interface RawTaxCode {
  code: number;
  name_ja: string;
  available: boolean;
}

export async function getTaxCodes(auth: FreeeAuth): Promise<TaxCode[]> {
  if (isE2ETestMode()) {
    return e2eTaxCodes;
  }
  const data = await freeeFetch(auth, `/taxes/companies/${auth.companyId}`);
  return (data.taxes as RawTaxCode[])
    .filter((tax) => tax.available)
    .map((tax) => ({ code: tax.code, name: tax.name_ja }));
}

export async function getWalletables(auth: FreeeAuth): Promise<Walletable[]> {
  if (isE2ETestMode()) {
    return e2eWalletables;
  }
  const data = await freeeFetch(
    auth,
    `/walletables?company_id=${auth.companyId}`,
  );
  return data.walletables;
}

export async function getPartners(auth: FreeeAuth): Promise<Partner[]> {
  const data = await freeeFetch(auth, `/partners?company_id=${auth.companyId}`);
  return data.partners;
}

export async function createDeal(
  auth: FreeeAuth,
  input: CreateDealInput,
): Promise<CreatedDeal> {
  const data = await freeeFetch(auth, "/deals", {
    method: "POST",
    body: JSON.stringify({
      company_id: Number(auth.companyId),
      issue_date: input.issueDate,
      type: "expense",
      details: [
        {
          account_item_id: input.accountItemId,
          tax_code: input.taxCode,
          amount: input.amount,
          description: input.description,
          ...(input.memoTagIds ? { tag_ids: input.memoTagIds } : {}),
        },
      ],
      ...(input.receiptIds ? { receipt_ids: input.receiptIds } : {}),
    }),
  });
  return data.deal;
}
