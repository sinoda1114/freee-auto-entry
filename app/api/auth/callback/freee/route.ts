import { NextRequest, NextResponse } from "next/server";
import { getCanonicalSiteOrigin } from "@/lib/auth/canonical-site";
import { getFreeeOAuthConfig } from "@/lib/freee/config";
import { getCompanies } from "@/lib/freee/company";
import { exchangeCodeForToken } from "@/lib/freee/oauth";
import { saveCompanyConnection } from "@/lib/freee/session-client";
import { getSession } from "@/lib/session";

function authErrorRedirect(request: NextRequest, reason: string): NextResponse {
  const siteUrl =
    getCanonicalSiteOrigin() ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin;
  const destination = new URL("/", siteUrl);
  destination.searchParams.set("authError", reason);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const siteUrl =
    getCanonicalSiteOrigin() ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin;

  const session = await getSession();

  if (!code || !state || state !== session.oauthState) {
    return authErrorRedirect(request, "state_mismatch");
  }

  const config = getFreeeOAuthConfig();
  if (!config) {
    return authErrorRedirect(request, "oauth_config");
  }

  try {
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
  } catch {
    return authErrorRedirect(request, "token_exchange");
  }
}
