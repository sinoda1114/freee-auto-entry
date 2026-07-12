import { isE2ETestMode } from "@/lib/e2e/fixtures";
import type { FreeeAuth } from "./accounting";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export interface UploadedReceipt {
  id: number;
}

/**
 * freeeファイルボックスへ証憑ファイルをアップロードし、receipt IDを返す。
 * multipart/form-data で POST /api/1/receipts を呼ぶ。
 * Content-Type ヘッダーは fetch が boundary ごと自動設定するため指定しない。
 */
export async function uploadReceipt(
  auth: FreeeAuth,
  fileData: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<UploadedReceipt> {
  if (isE2ETestMode()) {
    return { id: 99999 };
  }

  const blob = new Blob([fileData], { type: mimeType });
  const form = new FormData();
  form.append("company_id", auth.companyId);
  form.append("receipt", blob, filename);

  const res = await fetch(`${ACCOUNTING_API_BASE}/receipts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee receipt upload failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { receipt: { id: number } };
  return { id: data.receipt.id };
}
