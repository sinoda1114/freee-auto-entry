import type { FreeeAuth, Walletable } from "./accounting";
import { getWalletables } from "./accounting";
import { getDealById } from "./deals-read";
import { getTransferById, listTransfersByDateRange } from "./transfers";
import {
  getWalletTransactionById,
  getWalletTransactionsByDateRange,
  type WalletTransaction,
} from "./wallet";
import type { ConsultationTarget } from "@/lib/ai/consultation-target";

const WALLETABLE_TYPE_LABELS: Record<string, string> = {
  bank_account: "銀行口座",
  credit_card: "クレジットカード",
  wallet: "現金・その他",
};

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveWalletableName(
  walletables: Walletable[],
  type: string,
  id: number,
): string {
  const found = walletables.find((item) => item.id === id);
  const typeLabel = WALLETABLE_TYPE_LABELS[type] ?? type;
  return found ? `${found.name}（${typeLabel}）` : `${typeLabel} #${id}`;
}

function summarizeWalletTxn(
  txn: WalletTransaction,
  walletableNames: Record<number, string>,
): string {
  const walletName =
    walletableNames[txn.walletableId] ?? `口座 #${txn.walletableId}`;
  return [
    `明細 #${txn.id}`,
    txn.date,
    `${txn.entrySide === "income" ? "入金" : "出金"} ${txn.amount}円`,
    walletName,
    txn.description,
    `status=${txn.status}`,
    `due_amount=${txn.dueAmount}`,
    `rule_matched=${txn.ruleMatched}`,
  ].join(" / ");
}

export interface ConsultationContextBundle {
  targetLabel: string | null;
  investigationWindow: { startDate: string; endDate: string };
  primaryRecord: string;
  relatedRecords: string[];
  walletableDirectory: string[];
}

async function gatherAroundDate(
  auth: FreeeAuth,
  centerDate: string,
): Promise<{ relatedWalletTxns: WalletTransaction[]; relatedTransfers: string[] }> {
  const startDate = shiftDate(centerDate, -7);
  const endDate = shiftDate(centerDate, 7);
  const [walletTxns, transfers] = await Promise.all([
    getWalletTransactionsByDateRange(auth, { startDate, endDate, limit: 100 }),
    listTransfersByDateRange(auth, startDate, endDate, 100),
  ]);
  return {
    relatedWalletTxns: walletTxns,
    relatedTransfers: transfers.map(
      (transfer) =>
        `振替 #${transfer.id} / ${transfer.date} / ${transfer.amount}円 / ${transfer.fromWalletableType}#${transfer.fromWalletableId} → ${transfer.toWalletableType}#${transfer.toWalletableId}`,
    ),
  };
}

export async function gatherConsultationContext(
  auth: FreeeAuth,
  target: ConsultationTarget | null,
  question: string,
): Promise<ConsultationContextBundle> {
  const walletables = await getWalletables(auth);
  const walletableDirectory = walletables.map(
    (item) => `${item.name} (id=${item.id})`,
  );
  const walletableNames = Object.fromEntries(
    walletables.map((item) => [item.id, item.name]),
  );

  if (!target) {
    return {
      targetLabel: null,
      investigationWindow: {
        startDate: shiftDate(new Date().toISOString().slice(0, 10), -30),
        endDate: new Date().toISOString().slice(0, 10),
      },
      primaryRecord: `調査対象 ID は未指定です。質問: ${question}`,
      relatedRecords: [],
      walletableDirectory,
    };
  }

  if (target.kind === "transfer") {
    const transfer = await getTransferById(auth, target.id);
    const { relatedWalletTxns, relatedTransfers } = await gatherAroundDate(
      auth,
      transfer.date,
    );
    const fromName = resolveWalletableName(
      walletables,
      transfer.fromWalletableType,
      transfer.fromWalletableId,
    );
    const toName = resolveWalletableName(
      walletables,
      transfer.toWalletableType,
      transfer.toWalletableId,
    );
    const amountMatches = relatedWalletTxns.filter(
      (txn) => Math.abs(txn.amount) === Math.abs(transfer.amount),
    );
<<<<<<< HEAD
    const descriptionHints = relatedWalletTxns.filter((txn) =>
      /ｼﾞﾖｰｽﾞ|ジョーズ|JOE|ガレージ|GARAGE/i.test(txn.description),
    );
=======
    const descriptionHints: WalletTransaction[] = [];
>>>>>>> origin/main

    return {
      targetLabel: `口座振替 #${transfer.id}`,
      investigationWindow: {
        startDate: shiftDate(transfer.date, -7),
        endDate: shiftDate(transfer.date, 7),
      },
      primaryRecord: [
        `口座振替 #${transfer.id}`,
        `日付 ${transfer.date}`,
        `金額 ${transfer.amount}円`,
        `振替元 ${fromName}`,
        `振替先 ${toName}`,
        transfer.description ? `備考 ${transfer.description}` : "備考なし",
      ].join(" / "),
      relatedRecords: [
        ...relatedTransfers.filter((line) => !line.includes(`#${transfer.id} /`)),
        ...amountMatches.map((txn) => summarizeWalletTxn(txn, walletableNames)),
        ...descriptionHints.map((txn) => summarizeWalletTxn(txn, walletableNames)),
      ].slice(0, 20),
      walletableDirectory,
    };
  }

  if (target.kind === "deal") {
    const deal = await getDealById(auth, target.id);
    const { relatedWalletTxns, relatedTransfers } = await gatherAroundDate(
      auth,
      deal.issueDate,
    );
    const detailText = deal.details
      .map((detail) => detail.description ?? "")
      .filter(Boolean)
      .join(" / ");

    return {
      targetLabel: `取引 #${deal.id}`,
      investigationWindow: {
        startDate: shiftDate(deal.issueDate, -7),
        endDate: shiftDate(deal.issueDate, 7),
      },
      primaryRecord: [
        `取引 #${deal.id}`,
        `発生日 ${deal.issueDate}`,
        `金額 ${deal.amount}円`,
        deal.type ? `区分 ${deal.type}` : "区分不明",
        `状態 ${deal.status}`,
        deal.dealOriginName ? `登録元 ${deal.dealOriginName}` : "登録元不明",
        detailText ? `明細 ${detailText}` : "明細なし",
      ].join(" / "),
      relatedRecords: [
        ...relatedTransfers,
        ...relatedWalletTxns.map((txn) => summarizeWalletTxn(txn, walletableNames)),
      ].slice(0, 20),
      walletableDirectory,
    };
  }

  const walletTxn = await getWalletTransactionById(auth, target.id);
  const { relatedWalletTxns, relatedTransfers } = await gatherAroundDate(
    auth,
    walletTxn.date,
  );

  return {
    targetLabel: `口座明細 #${walletTxn.id}`,
    investigationWindow: {
      startDate: shiftDate(walletTxn.date, -7),
      endDate: shiftDate(walletTxn.date, 7),
    },
    primaryRecord: summarizeWalletTxn(walletTxn, walletableNames),
    relatedRecords: [
      ...relatedTransfers,
      ...relatedWalletTxns
        .filter((txn) => txn.id !== walletTxn.id)
        .map((txn) => summarizeWalletTxn(txn, walletableNames)),
    ].slice(0, 20),
    walletableDirectory,
  };
}
