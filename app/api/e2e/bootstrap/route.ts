import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.E2E_BOOTSTRAP_TOKEN;
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession();
  const expiresAt = Date.now() + 60 * 60 * 1000;

  session.accessToken = "e2e-access-token";
  session.refreshToken = "e2e-refresh-token";
  session.expiresAt = expiresAt;
  session.companyId = "11122591";
  session.companies = [
    {
      companyId: "11122591",
      companyName: "E2E Test Company",
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt,
    },
  ];
  await session.save();

  return NextResponse.json({ ok: true, companyId: session.companyId });
}
