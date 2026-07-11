import Link from "next/link";
import { getSession, isSessionAuthenticated } from "@/lib/session";
import { getConnectedCompanies } from "@/lib/freee/session-client";
import { CompanySwitcher } from "./CompanySwitcher";

export default async function Home() {
  const session = await getSession();
  const authenticated = isSessionAuthenticated(session);
  const { companies, activeCompanyId } = authenticated
    ? await getConnectedCompanies()
    : { companies: [], activeCompanyId: undefined };
  const activeCompany = companies.find((c) => c.companyId === activeCompanyId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-16 dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        freee-auto-entry
      </h1>

      {authenticated ? (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            freeeに接続済みです（事業所: {activeCompany?.companyName ?? session.companyId}）
          </p>
          {companies.length > 0 && (
            <CompanySwitcher
              key={activeCompanyId}
              companies={companies}
              activeCompanyId={activeCompanyId}
            />
          )}
          <div className="flex gap-4">
            <Link
              className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              href="/expenses/new"
            >
              経費を登録する
            </Link>
            <Link
              className="rounded-full border border-solid border-black/[.08] px-5 py-3 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              href="/invoices/new"
            >
              請求書を作成する
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-zinc-600 dark:text-zinc-400">
            経費登録・請求書作成を行うには、freeeとの連携が必要です。
          </p>
          <a
            className="rounded-full bg-foreground px-5 py-3 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            href="/api/auth/login"
          >
            freeeと連携する
          </a>
        </>
      )}
    </div>
  );
}
