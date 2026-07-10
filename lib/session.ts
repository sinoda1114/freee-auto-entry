import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  companyId?: string;
  oauthState?: string;
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

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

export function isSessionAuthenticated(session: SessionData): boolean {
  return Boolean(
    session.accessToken && session.expiresAt && session.expiresAt > Date.now(),
  );
}
