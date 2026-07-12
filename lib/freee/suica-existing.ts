import type { FreeeAuth } from "@/lib/freee/accounting";
import { suicaFingerprint } from "@/lib/suica/dedupe";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

interface DealListResponse {
  deals: Array<{
    issue_date: string;
    amount: number;
    details?: Array<{ description?: string | null }>;
  }>;
}

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

/**
 * 期間内の Suica 支出取引から重複指紋セットを構築する。
 */
export async function listExistingSuicaFingerprints(
  auth: FreeeAuth,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const fingerprints = new Set<string>();
  let offset = 0;
  const limit = 100;
  const maxPages = 30;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      company_id: auth.companyId,
      type: "expense",
      start_issue_date: startDate,
      end_issue_date: endDate,
      limit: String(limit),
      offset: String(offset),
    });
    const data = (await freeeFetch(
      auth,
      `/deals?${params.toString()}`,
    )) as DealListResponse;

    const deals = Array.isArray(data.deals) ? data.deals : [];
    for (const deal of deals) {
      const description = deal.details?.[0]?.description;
      if (typeof description !== "string" || !description.startsWith("Suica ")) {
        continue;
      }
      fingerprints.add(
        suicaFingerprint(deal.issue_date, deal.amount, description),
      );
    }

    if (deals.length < limit) break;
    offset += limit;
  }

  return fingerprints;
}
