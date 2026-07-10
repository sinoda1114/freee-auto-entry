import { getSession } from "@/lib/session";
import { getFreeeOAuthConfig } from "./config";
import { refreshAccessToken } from "./oauth";
import type { FreeeAuth } from "./accounting";

export async function getValidFreeeAuth(): Promise<FreeeAuth | null> {
  const session = await getSession();

  if (!session.accessToken || !session.companyId) {
    return null;
  }

  const isExpired = !session.expiresAt || session.expiresAt <= Date.now();
  if (!isExpired) {
    return { accessToken: session.accessToken, companyId: session.companyId };
  }

  if (!session.refreshToken) {
    return null;
  }

  const config = getFreeeOAuthConfig();
  if (!config) {
    return null;
  }

  const token = await refreshAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: session.refreshToken,
  });

  session.accessToken = token.access_token;
  session.refreshToken = token.refresh_token;
  session.expiresAt = Date.now() + token.expires_in * 1000;
  session.companyId = token.company_id;
  await session.save();

  return { accessToken: session.accessToken, companyId: session.companyId };
}
