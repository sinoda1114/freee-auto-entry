export const SUPPORT_THREAD_CATEGORIES = [
  { value: "accounting", label: "会計" },
  { value: "hr", label: "人事労務" },
  { value: "invoice", label: "請求書" },
  { value: "project_management", label: "工数管理" },
  { value: "sales_management", label: "販売管理" },
  { value: "it_management", label: "IT管理" },
  { value: "sign", label: "電子契約" },
  { value: "api", label: "API・連携" },
  { value: "other", label: "その他" },
] as const;

export type SupportThreadCategory =
  (typeof SUPPORT_THREAD_CATEGORIES)[number]["value"];

export const SUPPORT_THREAD_CATEGORY_VALUES =
  SUPPORT_THREAD_CATEGORIES.map((category) => category.value);

export function isSupportThreadCategory(
  value: unknown,
): value is SupportThreadCategory {
  return (
    typeof value === "string" &&
    SUPPORT_THREAD_CATEGORY_VALUES.some((category) => category === value)
  );
}

export function supportThreadCategoryLabel(
  category: SupportThreadCategory,
): string {
  return (
    SUPPORT_THREAD_CATEGORIES.find((item) => item.value === category)?.label ??
    "その他"
  );
}
