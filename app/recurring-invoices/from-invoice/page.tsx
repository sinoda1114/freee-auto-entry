import { getInvoices } from "@/lib/freee/invoice";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { FromInvoiceView } from "../FromInvoiceView";

export default async function FromInvoicePage() {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return <p className="p-10 text-center">freeeへ再連携してください。</p>;
  }

  let invoices;
  try {
    invoices = await getInvoices(auth, { offset: 0, limit: 100 });
  } catch {
    return (
      <p className="p-10 text-center text-danger">
        請求書一覧を取得できませんでした。
      </p>
    );
  }

  return <FromInvoiceView invoices={invoices} />;
}
