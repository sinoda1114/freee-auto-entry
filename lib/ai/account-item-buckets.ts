import type { AccountItem } from "@/lib/freee/accounting";
import { MAX_JEV_CHOICES } from "./jev-config";

export { MAX_JEV_CHOICES, isWithinJevChoiceLimit } from "./jev-config";

export const OTHER_BUCKET_KEY = "other";
export const OTHER_BUCKET_LABEL = "その他";

export interface AccountItemBucket {
  key: string;
  label: string;
  items: AccountItem[];
}

interface BucketDef {
  key: string;
  label: string;
  pattern: RegExp;
}

const BUCKET_DEFS: readonly BucketDef[] = [
  {
    key: "cogs",
    label: "仕入・原価",
    pattern: /仕入|売上原価|製造原価/,
  },
  {
    key: "sales",
    label: "売上・収益",
    pattern: /売上|雑収入|受取利息|受取配当|受取手数料|営業外収益/,
  },
  {
    key: "payroll",
    label: "人件費",
    pattern: /給料|給与|賃金|賞与|役員報酬|法定福利|福利厚生|退職|通勤手当/,
  },
  {
    key: "travel",
    label: "旅費交通費",
    pattern: /旅費|交通費|通勤|電車|乗車券|高速|駐車場|出張|タクシー|運賃/,
  },
  {
    key: "comms",
    label: "通信費",
    pattern: /通信|電話|インターネット|クラウド|サーバー|ドメイン|回線/,
  },
  {
    key: "utilities",
    label: "水道光熱費",
    pattern: /水道|光熱|電気代|ガス代/,
  },
  {
    key: "supplies",
    label: "消耗品・事務用品",
    pattern: /消耗品|事務用品/,
  },
  {
    key: "meeting",
    label: "会議費",
    pattern: /会議/,
  },
  {
    key: "entertainment",
    label: "交際費",
    pattern: /交際|接待/,
  },
  {
    key: "rent",
    label: "地代家賃",
    pattern: /地代|家賃|賃借|リース/,
  },
  {
    key: "fees",
    label: "支払手数料・報酬",
    pattern: /手数料|支払報酬|外注|顧問/,
  },
  {
    key: "ads",
    label: "広告宣伝費",
    pattern: /広告|宣伝|販促/,
  },
  {
    key: "insurance",
    label: "保険料",
    pattern: /保険料/,
  },
  {
    key: "tax",
    label: "租税公課",
    pattern: /租税|公課|印紙/,
  },
  {
    key: "depreciation",
    label: "減価償却",
    pattern: /減価償却/,
  },
  {
    key: "repair",
    label: "修繕費",
    pattern: /修繕|保守/,
  },
  {
    key: "books",
    label: "新聞図書費",
    pattern: /新聞|図書|書籍/,
  },
  {
    key: "training",
    label: "研修費",
    pattern: /研修|教育|セミナー/,
  },
  {
    key: "dues",
    label: "諸会費",
    pattern: /会費|組合費/,
  },
  {
    key: "assets",
    label: "資産",
    pattern:
      /預金|現金|売掛|受取手形|貸付|前払|立替|仮払|棚卸|建物|車両|土地|貸倒/,
  },
  {
    key: "liabilities",
    label: "負債",
    pattern: /買掛|未払|借入|預り|前受|引当/,
  },
  {
    key: "equity",
    label: "資本・純資産",
    pattern: /資本金|繰越利益|元入|純資産/,
  },
];

export function assignAccountItemBucketKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return OTHER_BUCKET_KEY;
  }
  for (const def of BUCKET_DEFS) {
    if (def.pattern.test(trimmed)) {
      return def.key;
    }
  }
  return OTHER_BUCKET_KEY;
}

function labelForBucketKey(key: string): string {
  if (key === OTHER_BUCKET_KEY) {
    return OTHER_BUCKET_LABEL;
  }
  const def = BUCKET_DEFS.find((item) => item.key === key);
  return def?.label ?? OTHER_BUCKET_LABEL;
}

function splitOversizedBucket(bucket: AccountItemBucket): AccountItemBucket[] {
  if (bucket.items.length <= MAX_JEV_CHOICES) {
    return [bucket];
  }

  const chunks: AccountItemBucket[] = [];
  for (
    let offset = 0, index = 1;
    offset < bucket.items.length;
    offset += MAX_JEV_CHOICES, index += 1
  ) {
    chunks.push({
      key: `${bucket.key}_${index}`,
      label: `${bucket.label}（${index}）`,
      items: bucket.items.slice(offset, offset + MAX_JEV_CHOICES),
    });
  }
  return chunks;
}

export function buildAccountItemBuckets(
  accountItems: AccountItem[],
): AccountItemBucket[] {
  const grouped = new Map<string, AccountItem[]>();

  for (const item of accountItems) {
    if (!item.name.trim()) {
      continue;
    }
    const key = assignAccountItemBucketKey(item.name);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  const buckets: AccountItemBucket[] = [];
  for (const def of BUCKET_DEFS) {
    const items = grouped.get(def.key);
    if (!items || items.length === 0) {
      continue;
    }
    buckets.push(...splitOversizedBucket({ key: def.key, label: def.label, items }));
  }

  const otherItems = grouped.get(OTHER_BUCKET_KEY);
  if (otherItems && otherItems.length > 0) {
    buckets.push(
      ...splitOversizedBucket({
        key: OTHER_BUCKET_KEY,
        label: labelForBucketKey(OTHER_BUCKET_KEY),
        items: otherItems,
      }),
    );
  }

  return buckets;
}

export function accountItemChoiceKey(item: AccountItem): string {
  return `item_${item.id}`;
}
