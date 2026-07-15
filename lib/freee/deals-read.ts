import type { FreeeAuth } from "./accounting";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface DealSummary {
  id: number;
  companyId: string;
  issueDate: string;
  amount: number;
  type?: "income" | "expense";
  status: string;
  dealOriginName?: string;
  refNumber?: string;
  details: Array<{ description?: string; accountItemId?: number; amount?: number }>;
  payments: Array<{
    amount?: number;
    date?: string;
    fromWalletableType?: string;
    fromWalletableId?: number;
  }>;
}

const e2eDeal: DealSummary = {
  id: 90001,
  companyId: "11122591",
  issueDate: "2025-08-05",
  amount: 5000,
  type: "expense",
  status: "settled",
  dealOriginName: "手動",
  details: [{ description: "ジョーズガレージ", amount: 5000 }],
  payments: [
    {
      amount: 5000,
      date: "2025-08-05",
      fromWalletableType: "credit_card",
      fromWalletableId: 20,
    },
  ],
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

function parseDeal(value: unknown): DealSummary {
  if (typeof value !== "object" || value === null) {
    throw new Error("freee deal response is invalid");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "number" ||
    typeof row.issue_date !== "string" ||
    typeof row.amount !== "number" ||
    typeof row.status !== "string"
  ) {
    throw new Error("freee deal response is invalid");
  }

  const details = Array.isArray(row.details)
    ? row.details.map((detail) => {
        const item = detail as Record<string, unknown>;
        return {
          description:
            typeof item.description === "string" ? item.description : undefined,
          accountItemId:
            typeof item.account_item_id === "number"
              ? item.account_item_id
              : undefined,
          amount: typeof item.amount === "number" ? item.amount : undefined,
        };
      })
    : [];

  const payments = Array.isArray(row.payments)
    ? row.payments.map((payment) => {
        const item = payment as Record<string, unknown>;
        return {
          amount: typeof item.amount === "number" ? item.amount : undefined,
          date: typeof item.date === "string" ? item.date : undefined,
          fromWalletableType:
            typeof item.from_walletable_type === "string"
              ? item.from_walletable_type
              : undefined,
          fromWalletableId:
            typeof item.from_walletable_id === "number"
              ? item.from_walletable_id
              : undefined,
        };
      })
    : [];

  return {
    id: row.id,
    companyId: String(row.company_id),
    issueDate: row.issue_date,
    amount: row.amount,
    type: row.type === "income" || row.type === "expense" ? row.type : undefined,
    status: row.status,
    dealOriginName:
      typeof row.deal_origin_name === "string"
        ? row.deal_origin_name
        : undefined,
    refNumber:
      typeof row.ref_number === "string" ? row.ref_number : undefined,
    details,
    payments,
  };
}

export async function getDealById(
  auth: FreeeAuth,
  id: number,
): Promise<DealSummary> {
  if (isE2ETestMode()) {
    return { ...e2eDeal, id };
  }
  const params = new URLSearchParams({ company_id: auth.companyId });
  const data = (await freeeFetch(auth, `/deals/${id}?${params}`)) as {
    deal?: unknown;
  };
  if (!data.deal) {
    throw new Error("freee deal response is invalid");
  }
  return parseDeal(data.deal);
}
