import Link from "next/link";
import { getAccountItems, getTaxCodes } from "@/lib/freee/accounting";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { ExpenseForm } from "./ExpenseForm";

export default async function NewExpensePage() {
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

  const [accountItems, taxCodes] = await Promise.all([
    getAccountItems(auth),
    getTaxCodes(auth),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-16">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← トップに戻る
      </Link>
      <h1 className="text-2xl font-semibold">経費を登録</h1>
      <ExpenseForm accountItems={accountItems} taxCodes={taxCodes} />
    </div>
  );
}
