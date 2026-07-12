import { describe, expect, it } from "vitest";
import {
  fingerprintFromItem,
  formatSuicaExpenseDescription,
  normalizeSuicaDescription,
  partitionByExistingFingerprints,
  suicaFingerprint,
} from "./dedupe";
import type { SuicaTransitItem } from "./history";

function item(partial: Partial<SuicaTransitItem>): SuicaTransitItem {
  return {
    date: "2026-07-12",
    amount: 188,
    balance: 10553,
    processType: 1,
    entranceCode: 0,
    exitCode: 0,
    region: 0,
    sequence: 1,
    description: "Suica 運賃 相模鉄道 横浜→西谷",
    ...partial,
  };
}

describe("suica dedupe", () => {
  it("normalizes balance and hash suffixes", () => {
    expect(
      normalizeSuicaDescription("Suica 運賃 相模鉄道 横浜→西谷（残10553）"),
    ).toBe("Suica 運賃 相模鉄道 横浜→西谷");
    expect(
      normalizeSuicaDescription("Suica 運賃 相模鉄道 横浜→西谷 #211"),
    ).toBe("Suica 運賃 相模鉄道 横浜→西谷");
  });

  it("matches item against existing freee description with balance", () => {
    const fp = fingerprintFromItem(item({}));
    const existing = new Set([
      suicaFingerprint(
        "2026-07-12",
        188,
        "Suica 運賃 相模鉄道 横浜→西谷（残10553）",
      ),
    ]);
    expect(existing.has(fp)).toBe(true);
  });

  it("partitions fresh vs duplicates", () => {
    const items = [
      item({ description: "Suica 運賃 相模鉄道 横浜→西谷" }),
      item({
        date: "2026-07-11",
        description: "Suica 運賃 相模鉄道 西谷→横浜",
        balance: 10741,
      }),
    ];
    const existing = new Set([fingerprintFromItem(items[0]!)]);
    const result = partitionByExistingFingerprints(items, existing);
    expect(result.duplicateIndexes).toEqual([0]);
    expect(result.freshIndexes).toEqual([1]);
  });

  it("formats description with balance", () => {
    expect(formatSuicaExpenseDescription(item({}))).toBe(
      "Suica 運賃 相模鉄道 横浜→西谷（残10553）",
    );
  });
});
