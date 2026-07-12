import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFreeeOAuthConfig } from "@/lib/freee/config";
import { refreshAccessToken } from "@/lib/freee/oauth";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function isTokenExpired(expiresAt?: number): boolean {
  return !expiresAt || expiresAt <= Date.now();
}

/**
 * Server Component では cookie を更新できないため、期限切れトークンの
 * リフレッシュ＋永続化は Route Handler で行う。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const redirectUrl = new URL(returnTo, url.origin);

  const session = await getSession();
  if (!session.accessToken || !session.companyId || !session.refreshToken) {
    return NextResponse.redirect(new URL("/api/auth/login", url.origin));
  }

  if (!isTokenExpired(session.expiresAt)) {
    return NextResponse.redirect(redirectUrl);
  }

  const config = getFreeeOAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/api/auth/login", url.origin));
  }

  try {
    const token = await refreshAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: session.refreshToken,
    });

    session.accessToken = token.access_token;
    session.refreshToken = token.refresh_token;
    session.expiresAt = Date.now() + token.expires_in * 1000;
    session.companyId = token.company_id;

    if (session.companies) {
      session.companies = session.companies.map((connection) =>
        String(connection.companyId) === token.company_id
          ? {
              ...connection,
              accessToken: token.access_token,
              refreshToken: token.refresh_token,
              expiresAt: session.expiresAt as number,
            }
          : connection,
      );
    }

    await session.save();
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(new URL("/api/auth/login", url.origin));
  }
}
