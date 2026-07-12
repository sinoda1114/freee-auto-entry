import { NextRequest, NextResponse } from "next/server";
import { getFreeeOAuthConfig } from "@/lib/freee/config";
import { getCompanies } from "@/lib/freee/company";
import { exchangeCodeForToken } from "@/lib/freee/oauth";
import { saveCompanyConnection } from "@/lib/freee/session-client";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  const session = await getSession();

  if (!code || !state || state !== session.oauthState) {
    return NextResponse.json(
      { error: "認可リクエストが不正です(stateの不一致、またはcode欠落)" },
      { status: 400 },
    );
  }

  const config = getFreeeOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "freee OAuthの環境変数が未設定です" },
      { status: 500 },
    );
  }

  const token = await exchangeCodeForToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code,
    redirectUri: config.redirectUri,
  });

  let companyName = `事業所 ${token.company_id}`;
  try {
    const companies = await getCompanies(token.access_token);
    const matched = companies.find(
      (company) => String(company.id) === token.company_id,
    );
    if (matched) {
      companyName = matched.displayName ?? matched.name;
    }
  } catch {
    // 事業所名の取得に失敗しても認可自体は継続する(フォールバック名を使う)
  }

  const returnTo = session.oauthReturnTo;
  session.oauthReturnTo = undefined;
  await session.save();

  await saveCompanyConnection({
    companyId: token.company_id,
    companyName,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
  });

  const destination =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";
  return NextResponse.redirect(new URL(destination, siteUrl));
}
