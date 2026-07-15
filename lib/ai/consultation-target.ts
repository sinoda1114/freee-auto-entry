export type ConsultationTargetKind = "transfer" | "deal" | "wallet_txn";

export interface ConsultationTarget {
  kind: ConsultationTargetKind;
  id: number;
}

function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * freee URL や自由記述から調査対象 ID を抽出する。
 * 例: https://secure.freee.co.jp/deals#code=transfer&deal_id=3137219490
 */
export function parseConsultationTarget(text: string): ConsultationTarget | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const walletTxnId =
    parsePositiveInt(normalized.match(/wallet_txn_id=(\d+)/i)?.[1]) ??
    parsePositiveInt(normalized.match(/wallet[_-]?txn[:\s#=]+(\d+)/i)?.[1]);
  if (walletTxnId) {
    return { kind: "wallet_txn", id: walletTxnId };
  }

  const dealId = parsePositiveInt(normalized.match(/deal_id=(\d+)/i)?.[1]);
  if (dealId) {
    const isTransfer =
      /code=transfer/i.test(normalized) ||
      /口座振替/.test(normalized) ||
      /振替/.test(normalized);
    return {
      kind: isTransfer ? "transfer" : "deal",
      id: dealId,
    };
  }

  const transferId = parsePositiveInt(
    normalized.match(/transfer[_-]?id[=:\s#]+(\d+)/i)?.[1],
  );
  if (transferId) {
    return { kind: "transfer", id: transferId };
  }

  const bareId = parsePositiveInt(normalized.match(/^#?(\d{5,})$/)?.[1]);
  if (bareId) {
    return { kind: "transfer", id: bareId };
  }

  return null;
}

export function formatConsultationTargetLabel(
  target: ConsultationTarget | null,
): string | null {
  if (!target) {
    return null;
  }
  const labels: Record<ConsultationTargetKind, string> = {
    transfer: "口座振替",
    deal: "取引",
    wallet_txn: "口座明細",
  };
  return `${labels[target.kind]} #${target.id}`;
}
