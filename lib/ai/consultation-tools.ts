import { tool } from "ai";
import { z } from "zod";
import type { FreeeAuth } from "@/lib/freee/accounting";
import {
  getCompanyFiscalYears,
  mapTaxAccountMethodLabel,
  mapTaxMethodLabel,
} from "@/lib/freee/company";
import { getDealById } from "@/lib/freee/deals-read";
import {
  formatGeneralLedgersForPrompt,
  formatTrialReportForPrompt,
  getGeneralLedgers,
  getTrialBs,
  getTrialPl,
} from "@/lib/freee/reports";
import { getTransferById, listTransfersByDateRange } from "@/lib/freee/transfers";
import {
  getWalletTransactionById,
  getWalletTransactionsByDateRange,
} from "@/lib/freee/wallet";
import { estimateConsumptionTaxMethods } from "@/lib/ai/consumption-tax-estimate";

type ToolOk<T> = { ok: true; data: T };
type ToolErr = { ok: false; error: string };
type ToolResult<T> = ToolOk<T> | ToolErr;

async function wrap<T>(fn: () => Promise<T>): Promise<ToolResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

const periodSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("開始日 yyyy-mm-dd。fiscalYear と同時指定しないこと"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("終了日 yyyy-mm-dd"),
  fiscalYear: z
    .number()
    .int()
    .optional()
    .describe("会計年度（開始日の年）。日付指定がある場合は使わない"),
});

export function createConsultationTools(auth: FreeeAuth) {
  return {
    get_fiscal_years: tool({
      description:
        "事業所の会計年度一覧を返す。各年度の開始・終了日、締め状態、経理方式（税込／税抜のラベル付き）を含む。",
      inputSchema: z.object({}),
      execute: async () =>
        wrap(async () => {
          const years = await getCompanyFiscalYears(auth);
          return years.map((fy) => ({
            id: fy.id,
            startDate: fy.startDate,
            endDate: fy.endDate,
            isClosed: fy.isClosed,
            taxAccountMethod: fy.taxAccountMethod,
            taxAccountMethodLabel: mapTaxAccountMethodLabel(fy.taxAccountMethod),
            taxMethod: fy.taxMethod,
            taxMethodLabel: mapTaxMethodLabel(fy.taxMethod),
          }));
        }),
    }),

    get_trial_pl: tool({
      description:
        "損益計算書を勘定科目単位で取得する。要約テキストと、金額のある科目内訳（name / amount / parent / level）を返す。",
      inputSchema: periodSchema,
      execute: async (input) =>
        wrap(async () => {
          const report = await getTrialPl(auth, {
            startDate: input.startDate,
            endDate: input.endDate,
            fiscalYear: input.fiscalYear,
            accountItemDisplayType: "account_item",
          });
          const lines = report.balances
            .filter((line) => line.closingBalance !== 0)
            .map((line) => ({
              name: line.accountItemName,
              amount: line.closingBalance,
              parent: line.parentAccountCategoryName,
              level: line.hierarchyLevel,
            }));
          return {
            text: formatTrialReportForPrompt("損益計算書", report, 80),
            lines,
            upToDate: report.upToDate,
            fiscalYear: report.fiscalYear,
            startDate: report.startDate,
            endDate: report.endDate,
          };
        }),
    }),

    get_trial_bs: tool({
      description:
        "貸借対照表を取得し、要約テキストと期間・鮮度情報を返す。",
      inputSchema: periodSchema,
      execute: async (input) =>
        wrap(async () => {
          const report = await getTrialBs(auth, {
            startDate: input.startDate,
            endDate: input.endDate,
            fiscalYear: input.fiscalYear,
          });
          return {
            text: formatTrialReportForPrompt("貸借対照表", report),
            upToDate: report.upToDate,
            fiscalYear: report.fiscalYear,
            startDate: report.startDate,
            endDate: report.endDate,
          };
        }),
    }),

    get_general_ledgers: tool({
      description:
        "総勘定元帳の科目サマリを返す（プランにより利用できない場合あり）。勘定科目名での絞り込みが可能。",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        accountItemName: z.string().optional().describe("勘定科目名で絞込"),
      }),
      execute: async (input) =>
        wrap(async () => {
          const ledgers = await getGeneralLedgers(auth, {
            startDate: input.startDate,
            endDate: input.endDate,
            accountItemName: input.accountItemName,
          });
          return {
            text: formatGeneralLedgersForPrompt(ledgers),
            count: ledgers.length,
          };
        }),
    }),

    get_transfer: tool({
      description: "口座振替1件を ID で取得して返す。",
      inputSchema: z.object({
        id: z.number().int().positive(),
      }),
      execute: async (input) =>
        wrap(async () => {
          const transfer = await getTransferById(auth, input.id);
          return transfer;
        }),
    }),

    list_transfers: tool({
      description: "指定期間の口座振替一覧を返す。",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input) =>
        wrap(async () => {
          const transfers = await listTransfersByDateRange(
            auth,
            input.startDate,
            input.endDate,
            input.limit ?? 50,
          );
          return transfers;
        }),
    }),

    get_deal: tool({
      description: "取引（deal）1件を ID で取得して返す。",
      inputSchema: z.object({
        id: z.number().int().positive(),
      }),
      execute: async (input) =>
        wrap(async () => {
          const deal = await getDealById(auth, input.id);
          return deal;
        }),
    }),

    get_wallet_txn: tool({
      description: "口座明細1件を ID で取得して返す。",
      inputSchema: z.object({
        id: z.number().int().positive(),
      }),
      execute: async (input) =>
        wrap(async () => {
          const txn = await getWalletTransactionById(auth, input.id);
          return txn;
        }),
    }),

    list_wallet_txns: tool({
      description: "指定期間の口座明細一覧を返す。",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input) =>
        wrap(async () => {
          const txns = await getWalletTransactionsByDateRange(auth, {
            startDate: input.startDate,
            endDate: input.endDate,
            limit: input.limit ?? 50,
          });
          return txns;
        }),
    }),

    estimate_consumption_tax: tool({
      description:
        "課税売上・課税仕入・みなし仕入率を受け取り、一般課税と簡易課税の納付見込を純計算で概算比較する。申告の最終判断ではない。",
      inputSchema: z.object({
        taxableSales: z.number().describe("課税売上金額"),
        taxablePurchases: z.number().describe("課税仕入金額（一般課税用）"),
        simplifiedPurchaseRate: z
          .number()
          .min(0)
          .max(1)
          .describe("みなし仕入率 0–1。例: サービス業第5種なら 0.5"),
        // Gemini tool schema は数値 enum を拒否するため文字列にする
        taxRate: z
          .enum(["0.1", "0.08"])
          .optional()
          .describe("消費税率。未指定時は 0.1"),
        taxIncluded: z
          .boolean()
          .optional()
          .describe("金額が税込なら true（既定 false=税抜）"),
      }),
      execute: async (input) => {
        try {
          const taxRate =
            input.taxRate === "0.08"
              ? (0.08 as const)
              : input.taxRate === "0.1"
                ? (0.1 as const)
                : undefined;
          const result = estimateConsumptionTaxMethods({
            taxableSales: input.taxableSales,
            taxablePurchases: input.taxablePurchases,
            simplifiedPurchaseRate: input.simplifiedPurchaseRate,
            taxRate,
            taxIncluded: input.taxIncluded,
          });
          return { ok: true as const, data: result };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : "unknown error",
          };
        }
      },
    }),
  };
}

export type ConsultationTools = ReturnType<typeof createConsultationTools>;
