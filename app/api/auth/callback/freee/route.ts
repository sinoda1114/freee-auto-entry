import { NextRequest, NextResponse } from "next/server";
import { getFreeeOAuthConfig } from "@/lib/freee/config";
import { exchangeCodeForToken } from "@/lib/freee/oauth";
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

  session.accessToken = token.access_token;
  session.refreshToken = token.refresh_token;
  session.expiresAt = Date.now() + token.expires_in * 1000;
  session.companyId = token.company_id;
  session.oauthState = undefined;
  await session.save();

  return NextResponse.redirect(new URL("/", siteUrl));
}
