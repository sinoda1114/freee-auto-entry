import Link from "next/link";
import { getPartners } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { InvoiceForm } from "./InvoiceForm";

export default async function NewInvoicePage() {
  const auth = await getValidFreeeAuth();

  if (!auth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-16">
        <p className="text-zinc-600 dark:text-zinc-400">
          freeeとの連携が切れています。もう一度ログインしてください。
        </p>
        <a
          className="rounded-full bg-foreground px-5 py-3 text-background"
          href="/api/auth/login"
        >
          freeeと連携する
        </a>
      </div>
    );
  }

  const partners = await getPartners(auth);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-16">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← トップに戻る
      </Link>
      <h1 className="text-2xl font-semibold">請求書を作成</h1>
      <InvoiceForm partners={partners} companyId={auth.companyId} />
    </div>
  );
}
