const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface FreeeCompany {
  id: number;
  name: string;
  displayName: string | null;
}

interface RawCompany {
  id: number;
  name: string;
  display_name: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRawCompany(value: unknown): value is RawCompany {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    (typeof value.display_name === "string" || value.display_name === null)
  );
}

/**
 * ログインユーザーが所属する事業所一覧を取得する。
 * (GET /api/1/companies)
 */
export async function getCompanies(accessToken: string): Promise<FreeeCompany[]> {
  const res = await fetch(`${ACCOUNTING_API_BASE}/companies`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee companies API request failed: ${res.status} ${text}`);
  }

  const data: unknown = await res.json();
  if (
    !isRecord(data) ||
    !Array.isArray(data.companies) ||
    !data.companies.every(isRawCompany)
  ) {
    throw new Error("freee companies API response is invalid");
  }

  return data.companies.map((company) => ({
    id: company.id,
    name: company.name,
    displayName: company.display_name,
  }));
}
