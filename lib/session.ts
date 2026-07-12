import { cookies } from "next/headers";
import { cache } from "react";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export interface FreeeCompanyConnection {
  companyId: string;
  companyName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SessionData {
  /** 現在アクティブな事業所のアクセストークン(companiesの該当エントリと同期される) */
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  /** 現在アクティブな事業所のID */
  companyId?: string;
  oauthState?: string;
  /** OAuth 完了後に戻す同一オリジン相対パス（例: /expenses/suica?p=...） */
  oauthReturnTo?: string;
  /** OAuth認可済みの事業所ごとのトークン一覧(1トークン=1事業所のため複数保持する) */
  companies?: FreeeCompanyConnection[];
}

export function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET;
  if (!password) {
    throw new Error("AUTH_SECRET is not set");
  }

  return {
    password,
    cookieName: "freee-auto-entry-session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  };
}

async function readSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

export const getSession = cache(readSession);

export function isSessionAuthenticated(session: SessionData): boolean {
  return Boolean(
    session.accessToken && session.expiresAt && session.expiresAt > Date.now(),
  );
}
