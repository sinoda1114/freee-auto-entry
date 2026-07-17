/**
 * 消費税の一般課税 vs 簡易課税の概算比較（純計算）。
 * 税理士判断の代替ではない。前提を明示して返す。
 */

export type ConsumptionTaxRate = 0.1 | 0.08;

export interface ConsumptionTaxEstimateInput {
  /** 課税売上（税抜想定。税込の場合は taxIncluded=true） */
  taxableSales: number;
  /** 課税仕入（税抜想定。一般課税の仕入税額控除用） */
  taxablePurchases: number;
  /** みなし仕入率 0–1（例: 第5種サービス 0.5） */
  simplifiedPurchaseRate: number;
  /** 消費税率（既定 10%） */
  taxRate?: ConsumptionTaxRate;
  /** 金額が税込のとき true */
  taxIncluded?: boolean;
}

export interface ConsumptionTaxEstimateResult {
  assumptions: string[];
  outputTax: number;
  principleInputTax: number;
  principlePayable: number;
  simplifiedDeduction: number;
  simplifiedPayable: number;
  advantage: "principle" | "simplified" | "tie";
  advantageAmount: number;
  summaryJa: string;
}

function roundYen(value: number): number {
  return Math.round(value);
}

function toTaxExclusive(amount: number, rate: number, taxIncluded: boolean): number {
  if (!taxIncluded) {
    return amount;
  }
  return amount / (1 + rate);
}

export function estimateConsumptionTaxMethods(
  input: ConsumptionTaxEstimateInput,
): ConsumptionTaxEstimateResult {
  const rate = input.taxRate ?? 0.1;
  const taxIncluded = input.taxIncluded ?? false;
  const salesEx = toTaxExclusive(input.taxableSales, rate, taxIncluded);
  const purchasesEx = toTaxExclusive(input.taxablePurchases, rate, taxIncluded);
  const simplifiedRate = Math.min(1, Math.max(0, input.simplifiedPurchaseRate));

  const outputTax = roundYen(salesEx * rate);
  const principleInputTax = roundYen(purchasesEx * rate);
  const principlePayable = outputTax - principleInputTax;
  const simplifiedDeduction = roundYen(outputTax * simplifiedRate);
  const simplifiedPayable = outputTax - simplifiedDeduction;

  const diff = principlePayable - simplifiedPayable;
  let advantage: ConsumptionTaxEstimateResult["advantage"] = "tie";
  if (diff > 0) {
    advantage = "simplified";
  } else if (diff < 0) {
    advantage = "principle";
  }

  const assumptions = [
    taxIncluded
      ? "入力金額は税込として税抜換算してから計算しています。"
      : "入力金額は税抜として計算しています。",
    `消費税率は ${(rate * 100).toFixed(0)}% です。`,
    `みなし仕入率は ${(simplifiedRate * 100).toFixed(0)}% です。`,
    "軽減税率・輸出・非課税・共通用の按分・経過措置・インボイス特例は未考慮です。",
    "基準期間の課税売上高など、簡易課税の適用可否は別途確認が必要です。",
    "これは概算であり、申告の最終判断ではありません。",
  ];

  const advantageJa =
    advantage === "tie"
      ? "納付見込はほぼ同額"
      : advantage === "simplified"
        ? `簡易課税の方が約 ${Math.abs(diff).toLocaleString("ja-JP")} 円有利（納付が少ない）`
        : `一般課税の方が約 ${Math.abs(diff).toLocaleString("ja-JP")} 円有利（納付が少ない）`;

  const summaryJa = [
    `仮受消費税（概算）: ${outputTax.toLocaleString("ja-JP")} 円`,
    `一般課税の仕入税額控除（概算）: ${principleInputTax.toLocaleString("ja-JP")} 円 → 納付見込 ${principlePayable.toLocaleString("ja-JP")} 円`,
    `簡易課税のみなし仕入控除（概算）: ${simplifiedDeduction.toLocaleString("ja-JP")} 円 → 納付見込 ${simplifiedPayable.toLocaleString("ja-JP")} 円`,
    advantageJa,
  ].join("\n");

  return {
    assumptions,
    outputTax,
    principleInputTax,
    principlePayable,
    simplifiedDeduction,
    simplifiedPayable,
    advantage,
    advantageAmount: Math.abs(diff),
    summaryJa,
  };
}
