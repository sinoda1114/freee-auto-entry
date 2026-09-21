import { describe, expect, it } from "vitest";
import type { AccountItem } from "@/lib/freee/accounting";
import {
  accountItemChoiceKey,
  assignAccountItemBucketKey,
  buildAccountItemBuckets,
  isWithinJevChoiceLimit,
  MAX_JEV_CHOICES,
  OTHER_BUCKET_KEY,
} from "./account-item-buckets";

function item(id: number, name: string): AccountItem {
  return { id, name, defaultTaxCode: 136 };
}

describe("account item buckets", () => {
  it("assigns Japanese account names to coarse buckets", () => {
    expect(assignAccountItemBucketKey("旅費交通費")).toBe("travel");
    expect(assignAccountItemBucketKey("通勤費")).toBe("travel");
    expect(assignAccountItemBucketKey("通勤手当")).toBe("payroll");
    expect(assignAccountItemBucketKey("通信費")).toBe("comms");
    expect(assignAccountItemBucketKey("会議費")).toBe("meeting");
    expect(assignAccountItemBucketKey("雑費")).toBe(OTHER_BUCKET_KEY);
    expect(assignAccountItemBucketKey("普通預金")).toBe("assets");
    expect(assignAccountItemBucketKey("売上高")).toBe("sales");
    expect(assignAccountItemBucketKey("売上原価")).toBe("cogs");
    expect(assignAccountItemBucketKey("受取手数料")).toBe("sales");
    expect(assignAccountItemBucketKey("支払手数料")).toBe("fees");
  });

  it("omits empty buckets and keeps populated ones under the Choice cap", () => {
    const buckets = buildAccountItemBuckets([
      item(1, "通信費"),
      item(2, "会議費"),
      item(3, "雑費"),
      item(4, "  "),
    ]);

    expect(buckets.map((bucket) => bucket.key)).toEqual([
      "comms",
      "meeting",
      OTHER_BUCKET_KEY,
    ]);
    expect(buckets.every((bucket) => isWithinJevChoiceLimit(bucket.items.length))).toBe(
      true,
    );
    expect(buckets.length).toBeLessThan(255);
  });

  it("splits an oversized bucket so each Choice stays under 255", () => {
    const items = Array.from({ length: MAX_JEV_CHOICES + 1 }, (_, index) =>
      item(index + 1, `通信費${index}`),
    );
    const buckets = buildAccountItemBuckets(items);

    expect(buckets.length).toBe(2);
    expect(buckets[0]?.items).toHaveLength(MAX_JEV_CHOICES);
    expect(buckets[1]?.items).toHaveLength(1);
    expect(buckets.every((bucket) => bucket.items.length < 255)).toBe(true);
    expect(accountItemChoiceKey(items[0]!)).toBe("item_1");
  });
});
