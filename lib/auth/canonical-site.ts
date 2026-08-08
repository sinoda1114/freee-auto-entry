/**
 * OAuth の state cookie とコールバック URL のホストを揃えるため、
 * NEXT_PUBLIC_SITE_URL / FREEE_REDIRECT_URI から正規オリジンを返す。
 */
export function getCanonicalSiteOrigin(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // fall through
    }
  }

  const redirectUri = process.env.FREEE_REDIRECT_URI?.trim();
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * リクエストが正規ホストと違う場合、同じパス・クエリで正規オリジンへ飛ばす URL を返す。
 * 一致していれば null。
 */
export function canonicalRedirectUrl(requestUrl: URL): string | null {
  const canonical = getCanonicalSiteOrigin();
  if (!canonical) return null;

  let expected: URL;
  try {
    expected = new URL(canonical);
  } catch {
    return null;
  }

  if (requestUrl.host === expected.host) {
    return null;
  }

  const next = new URL(requestUrl.pathname + requestUrl.search, expected.origin);
  return next.toString();
}
