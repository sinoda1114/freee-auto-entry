import type { ConsultationTargetKind } from "@/lib/ai/consultation-target";
import { freeeWalletTxnStreamUrl } from "./wallet-url";

export function freeeRecordUrl(
  kind: ConsultationTargetKind,
  id: number,
): string {
  if (kind === "wallet_txn") {
    return freeeWalletTxnStreamUrl(id);
  }
  if (kind === "transfer") {
    return `https://secure.freee.co.jp/deals#code=transfer&deal_id=${id}`;
  }
  return `https://secure.freee.co.jp/deals#deal_id=${id}`;
}

export function freeeRecordLabel(
  kind: ConsultationTargetKind,
  id: number,
): string {
  const labels: Record<ConsultationTargetKind, string> = {
    transfer: "口座振替",
    deal: "取引",
    wallet_txn: "口座明細",
  };
  return `${labels[kind]} #${id}`;
}
