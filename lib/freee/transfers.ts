import type { FreeeAuth } from "./accounting";
import type { WalletableType } from "./wallet";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface Transfer {
  id: number;
  companyId: string;
  amount: number;
  date: string;
  fromWalletableType: WalletableType;
  fromWalletableId: number;
  toWalletableType: WalletableType;
  toWalletableId: number;
  description: string;
}

const e2eTransfer: Transfer = {
  id: 3137219490,
  companyId: "11122591",
  amount: 5000,
  date: "2025-08-05",
  fromWalletableType: "credit_card",
  fromWalletableId: 20,
  toWalletableType: "wallet",
  toWalletableId: 30,
  description: "",
};

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

function isWalletableType(value: unknown): value is WalletableType {
  return (
    value === "bank_account" ||
    value === "credit_card" ||
    value === "wallet"
  );
}

function parseTransfer(value: unknown): Transfer {
  if (typeof value !== "object" || value === null) {
    throw new Error("freee transfer response is invalid");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "number" ||
    typeof row.amount !== "number" ||
    typeof row.date !== "string" ||
    !isWalletableType(row.from_walletable_type) ||
    typeof row.from_walletable_id !== "number" ||
    !isWalletableType(row.to_walletable_type) ||
    typeof row.to_walletable_id !== "number"
  ) {
    throw new Error("freee transfer response is invalid");
  }
  return {
    id: row.id,
    companyId: String(row.company_id),
    amount: row.amount,
    date: row.date,
    fromWalletableType: row.from_walletable_type,
    fromWalletableId: row.from_walletable_id,
    toWalletableType: row.to_walletable_type,
    toWalletableId: row.to_walletable_id,
    description: typeof row.description === "string" ? row.description : "",
  };
}

export async function getTransferById(
  auth: FreeeAuth,
  id: number,
): Promise<Transfer> {
  if (isE2ETestMode()) {
    return { ...e2eTransfer, id };
  }
  const params = new URLSearchParams({ company_id: auth.companyId });
  const data = (await freeeFetch(
    auth,
    `/transfers/${id}?${params}`,
  )) as { transfer?: unknown };
  if (!data.transfer) {
    throw new Error("freee transfer response is invalid");
  }
  return parseTransfer(data.transfer);
}

export async function listTransfersByDateRange(
  auth: FreeeAuth,
  startDate: string,
  endDate: string,
  limit = 100,
): Promise<Transfer[]> {
  if (isE2ETestMode()) {
    return [e2eTransfer];
  }
  const params = new URLSearchParams({
    company_id: auth.companyId,
    start_date: startDate,
    end_date: endDate,
    limit: String(limit),
    offset: "0",
  });
  const data = (await freeeFetch(
    auth,
    `/transfers?${params}`,
  )) as { transfers?: unknown[] };
  if (!Array.isArray(data.transfers)) {
    return [];
  }
  return data.transfers.map(parseTransfer);
}
