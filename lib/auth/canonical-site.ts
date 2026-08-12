/**
 * OAuth の state cookie とコールバック URL のホストを揃える。
 * コールバック先（FREEE_REDIRECT_URI）を正とし、なければ NEXT_PUBLIC_SITE_URL を使う。
 */
export function getCanonicalSiteOrigin(): string | null {
  const redirectUri = process.env.FREEE_REDIRECT_URI?.trim();
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin;
    } catch {
      // fall through
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      return null;
    }
  }

  return null;
}

function isSafeRelativePath(pathname: string): boolean {
  return pathname.startsWith("/") && !pathname.startsWith("//");
}

/**
 * リクエストが正規ホストと違う場合、同じパス・クエリで正規オリジンへ飛ばす URL を返す。
 * 一致していれば null。オープンリダイレクト防止のため相対パスのみ許可する。
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

  if (!isSafeRelativePath(requestUrl.pathname)) {
    return null;
  }

  const next = new URL(requestUrl.pathname + requestUrl.search, expected.origin);
  if (next.origin !== expected.origin) {
    return null;
  }
  return next.toString();
}
