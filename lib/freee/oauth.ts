export const FREEE_AUTHORIZE_URL =
  "https://accounts.secure.freee.co.jp/public_api/authorize";
export const FREEE_TOKEN_URL = "https://accounts.secure.freee.co.jp/public_api/token";

export interface FreeeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  company_id: string;
  external_cid: string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(FREEE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("prompt", "select_company");
  return url.toString();
}

async function postTokenRequest(
  body: Record<string, string>,
): Promise<FreeeTokenResponse> {
  const res = await fetch(FREEE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    throw new Error(`freee token request failed: ${res.status}`);
  }

  return res.json();
}

export function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<FreeeTokenResponse> {
  return postTokenRequest({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });
}

export function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<FreeeTokenResponse> {
  return postTokenRequest({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });
}
