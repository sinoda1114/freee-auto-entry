import type { MatcherCondition } from "./wallet";

export const MATCHER_CONDITION_LABELS: Record<
  Exclude<MatcherCondition, 4>,
  string
> = {
  0: "部分一致",
  1: "前方一致",
  2: "後方一致",
  3: "完全一致",
};

export function matcherConditionLabel(condition: MatcherCondition): string {
  if (condition === 4) {
    return "条件なし";
  }
  return MATCHER_CONDITION_LABELS[condition];
}

export function matcherActLabel(act: number): string {
  switch (act) {
    case 0:
      return "取引を推測";
    case 1:
      return "取引を登録";
    case 2:
      return "振替を推測";
    case 3:
      return "振替を登録";
    case 4:
      return "無視する取引";
    case 10:
      return "無視を推測";
    case 11:
      return "プライベート推測";
    case 12:
      return "プライベート登録";
    default:
      return `act=${act}`;
  }
}

export function matcherEntrySideLabel(entrySide: "income" | "expense"): string {
  return entrySide === "income" ? "入金" : "出金";
}
