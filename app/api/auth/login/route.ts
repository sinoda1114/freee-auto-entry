import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { getFreeeOAuthConfig } from "@/lib/freee/config";
import { buildAuthorizeUrl } from "@/lib/freee/oauth";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const config = getFreeeOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "freee OAuthの環境変数が未設定です" },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const session = await getSession();
  session.oauthState = state;
  session.oauthReturnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
  );
  await session.save();

  const url = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });
  return NextResponse.redirect(url);
}
