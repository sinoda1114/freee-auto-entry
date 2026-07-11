export interface FreeeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getFreeeOAuthConfig(): FreeeOAuthConfig | null {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const redirectUri = process.env.FREEE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}
