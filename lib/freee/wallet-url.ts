import type { WalletTransaction } from "./wallet";

const FREEE_WALLET_TXNS_STREAM_BASE =
  "https://secure.freee.co.jp/wallet_txns/stream";

/** freee「自動で経理」画面で特定明細の登録フォームを開く URL */
export function freeeWalletTxnStreamUrl(transactionId: number): string {
  return `${FREEE_WALLET_TXNS_STREAM_BASE}#wallet_txn_id=${transactionId}`;
}

export function freeeWalletTxnStreamUrlFor(
  transaction: Pick<WalletTransaction, "id">,
): string {
  return freeeWalletTxnStreamUrl(transaction.id);
}

export const FREEE_WALLET_TXNS_LIST_URL =
  "https://secure.freee.co.jp/wallet_txns";
