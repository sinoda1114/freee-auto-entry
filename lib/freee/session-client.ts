import { cache } from "react";
import { getSession } from "@/lib/session";
import type { FreeeCompanyConnection, SessionData } from "@/lib/session";
import type { IronSession } from "iron-session";
import { getFreeeOAuthConfig } from "./config";
import { refreshAccessToken } from "./oauth";
import type { FreeeAuth } from "./accounting";

function isTokenExpired(expiresAt?: number): boolean {
  return !expiresAt || expiresAt <= Date.now();
}

/**
 * companies 配列導入前の旧セッション(トップレベルにだけトークンがある)を
 * companies へ移行する。既存エントリはそのまま返す。
 */
function withLegacyConnectionMigrated(session: SessionData): FreeeCompanyConnection[] {
  const companies = [...(session.companies ?? [])];

  if (
    session.companyId &&
    session.accessToken &&
    session.refreshToken &&
    session.expiresAt &&
    !companies.some(
      (connection) =>
        String(connection.companyId) === String(session.companyId),
    )
  ) {
    companies.push({
      companyId: String(session.companyId),
      companyName: `事業所 ${session.companyId}`,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    });
  }

  return companies;
}

async function refreshSessionTokenIfExpired(
  session: IronSession<SessionData>,
): Promise<boolean> {
  if (!session.accessToken || !session.companyId || !isTokenExpired(session.expiresAt)) {
    return Boolean(session.accessToken && session.companyId);
  }

  if (!session.refreshToken) {
    return false;
  }

  const config = getFreeeOAuthConfig();
  if (!config) {
    return false;
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

  if (session.companies) {
    session.companies = session.companies.map((connection) =>
      String(connection.companyId) === token.company_id
        ? {
            ...connection,
            accessToken: session.accessToken as string,
            refreshToken: session.refreshToken as string,
            expiresAt: session.expiresAt as number,
          }
        : connection,
    );
  }

  await session.save();
  return true;
}

export const getValidFreeeAuth = cache(async (): Promise<FreeeAuth | null> => {
  const session = await getSession();

  if (!session.accessToken || !session.companyId) {
    return null;
  }

  if (!isTokenExpired(session.expiresAt)) {
    return { accessToken: session.accessToken, companyId: session.companyId };
  }

  const refreshed = await refreshSessionTokenIfExpired(session);
  if (!refreshed || !session.accessToken || !session.companyId) {
    return null;
  }

  return { accessToken: session.accessToken, companyId: session.companyId };
});

/**
 * OAuth認可コールバックで取得したトークンを、事業所ごとの接続一覧に保存し、
 * その事業所をアクティブな事業所として設定する。
 * freeeのアクセストークンは1トークン=1事業所にスコープされるため、
 * 事業所を切り替えられるようにするには事業所ごとにトークンを保持する必要がある。
 */
export async function saveCompanyConnection(params: {
  companyId: string;
  companyName: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const session = await getSession();
  const expiresAt = Date.now() + params.expiresIn * 1000;

  const connection: FreeeCompanyConnection = {
    companyId: params.companyId,
    companyName: params.companyName,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresAt,
  };

  const migratedConnections = withLegacyConnectionMigrated(session);
  const otherConnections = migratedConnections.filter(
    (connection) => String(connection.companyId) !== params.companyId,
  );
  session.companies = [...otherConnections, connection];

  session.accessToken = connection.accessToken;
  session.refreshToken = connection.refreshToken;
  session.expiresAt = connection.expiresAt;
  session.companyId = connection.companyId;
  session.oauthState = undefined;

  await session.save();
}

/**
 * 認可済みの事業所の中からアクティブな事業所を切り替える。
 * まだ認可していない事業所が指定された場合は、呼び出し側でOAuth認可フローに
 * 誘導できるよう `not-connected` を返す。
 */
export async function switchActiveCompany(
  companyId: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "not-connected" | "refresh-failed" }
> {
  const session = await getSession();
  const connection = session.companies?.find(
    (candidate) => String(candidate.companyId) === companyId,
  );

  if (!connection) {
    return { ok: false, reason: "not-connected" };
  }

  if (isTokenExpired(connection.expiresAt)) {
    const config = getFreeeOAuthConfig();
    if (!config) {
      return { ok: false, reason: "refresh-failed" };
    }

    try {
      const token = await refreshAccessToken({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: connection.refreshToken,
      });
      const expiresAt = Date.now() + token.expires_in * 1000;

      session.accessToken = token.access_token;
      session.refreshToken = token.refresh_token;
      session.expiresAt = expiresAt;
      session.companyId = token.company_id;
      session.companies = session.companies?.map((candidate) =>
        String(candidate.companyId) === companyId
          ? {
              ...candidate,
              companyId: token.company_id,
              accessToken: token.access_token,
              refreshToken: token.refresh_token,
              expiresAt,
            }
          : candidate,
      );
    } catch {
      return { ok: false, reason: "refresh-failed" };
    }
  } else {
    session.accessToken = connection.accessToken;
    session.refreshToken = connection.refreshToken;
    session.expiresAt = connection.expiresAt;
    session.companyId = String(connection.companyId);
  }

  await session.save();
  return { ok: true };
}

export interface ConnectedCompaniesResult {
  companies: { companyId: string; companyName: string }[];
  activeCompanyId?: string;
}

/**
 * UI表示用に、認可済みの事業所一覧(トークンを含まない)とアクティブな事業所IDを返す。
 */
export const getConnectedCompanies = cache(
  async (): Promise<ConnectedCompaniesResult> => {
    const session = await getSession();
    const companies = withLegacyConnectionMigrated(session);

    return {
      companies: companies.map((c) => ({
        companyId: String(c.companyId),
        companyName: c.companyName,
      })),
      activeCompanyId:
        session.companyId === undefined ? undefined : String(session.companyId),
    };
  },
);
