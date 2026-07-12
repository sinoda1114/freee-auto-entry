/** OAuth 後の戻り先。オープンリダイレクト防止のため同一オリジン相対パスのみ許可。 */

export function sanitizeReturnTo(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (trimmed.startsWith("//")) return undefined;
  if (trimmed.includes("://")) return undefined;
  if (trimmed.includes("\\")) return undefined;
  return trimmed;
}

export function buildLoginHref(returnTo?: string): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return "/api/auth/login";
  return `/api/auth/login?returnTo=${encodeURIComponent(safe)}`;
}
