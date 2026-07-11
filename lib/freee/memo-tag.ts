import type { FreeeAuth } from "./accounting";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export const APP_MEMO_TAG_NAME = "freee-auto-entry";

interface Tag {
  id: number;
  name: string;
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

export async function getAppMemoTagId(auth: FreeeAuth): Promise<number> {
  const { tags } = (await freeeFetch(
    auth,
    `/tags?company_id=${auth.companyId}`,
  )) as { tags: Tag[] };

  const existing = tags.find((tag) => tag.name === APP_MEMO_TAG_NAME);
  if (existing) {
    return existing.id;
  }

  const { tag } = (await freeeFetch(auth, "/tags", {
    method: "POST",
    body: JSON.stringify({
      company_id: Number(auth.companyId),
      name: APP_MEMO_TAG_NAME,
    }),
  })) as { tag: Tag };

  return tag.id;
}
