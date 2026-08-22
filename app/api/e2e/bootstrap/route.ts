import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const DEFAULT_COMPANY_ID = "11122591";
const SHINODA_IT_COMPANY_ID = "11040830";

function companyNameFor(companyId: string): string {
  if (companyId === SHINODA_IT_COMPANY_ID) {
    return "篠田 ITサービス";
  }
  if (companyId === DEFAULT_COMPANY_ID) {
    return "株式会社Waalsforce";
  }
  return `E2E Company ${companyId}`;
}

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.E2E_BOOTSTRAP_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestedCompanyId = DEFAULT_COMPANY_ID;
  try {
    const body = (await request.json()) as { companyId?: string };
    if (body.companyId?.trim()) {
      requestedCompanyId = body.companyId.trim();
    }
  } catch {
    // no body — default company
  }

  const session = await getSession();
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const accessToken = "e2e-access-token";
  const refreshToken = "e2e-refresh-token";

  session.accessToken = accessToken;
  session.refreshToken = refreshToken;
  session.expiresAt = expiresAt;
  session.companyId = requestedCompanyId;
  session.companies = [
    {
      companyId: requestedCompanyId,
      companyName: companyNameFor(requestedCompanyId),
      accessToken,
      refreshToken,
      expiresAt,
    },
  ];
  await session.save();

  return NextResponse.json({ ok: true, companyId: session.companyId });
}
