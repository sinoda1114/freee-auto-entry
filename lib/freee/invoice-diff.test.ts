import { describe, expect, it } from "vitest";
import { computeInvoiceDiff, prevMonth } from "./invoice-diff";
import type { InvoiceLineSnapshot } from "./invoice-diff";

const line = (
  description: string,
  quantity: number,
  unitPrice: number,
  taxRate = 10,
): InvoiceLineSnapshot => ({ description, quantity, unitPrice, taxRate });

describe("computeInvoiceDiff", () => {
  it("returns no change when lines are identical", () => {
    const lines = [line("月次保守", 1, 100000)];
    const diff = computeInvoiceDiff(lines, lines);

    expect(diff.hasAnyChange).toBe(false);
    expect(diff.amountChanged).toBe(false);
    expect(diff.lineCountChanged).toBe(false);
    expect(diff.lineChanges).toHaveLength(1);
    expect(diff.lineChanges[0]?.type).toBe("same");
  });

  it("detects an amount change when unit price differs", () => {
    const prev = [line("月次保守", 1, 100000)];
    const curr = [line("月次保守", 1, 120000)];
    const diff = computeInvoiceDiff(prev, curr);

    expect(diff.hasAnyChange).toBe(true);
    expect(diff.amountChanged).toBe(true);
    expect(diff.prevTotal).toBe(100000);
    expect(diff.currTotal).toBe(120000);
    expect(diff.lineChanges[0]?.type).toBe("changed");
    expect(diff.lineChanges[0]?.prevAmount).toBe(100000);
    expect(diff.lineChanges[0]?.currAmount).toBe(120000);
  });

  it("detects added lines", () => {
    const prev = [line("月次保守", 1, 100000)];
    const curr = [line("月次保守", 1, 100000), line("オプション", 1, 20000)];
    const diff = computeInvoiceDiff(prev, curr);

    expect(diff.hasAnyChange).toBe(true);
    expect(diff.lineCountChanged).toBe(true);
    const added = diff.lineChanges.find((c) => c.type === "added");
    expect(added?.description).toBe("オプション");
    expect(added?.currAmount).toBe(20000);
    expect(added?.prevAmount).toBeNull();
  });

  it("detects removed lines", () => {
    const prev = [line("月次保守", 1, 100000), line("旧オプション", 1, 5000)];
    const curr = [line("月次保守", 1, 100000)];
    const diff = computeInvoiceDiff(prev, curr);

    expect(diff.hasAnyChange).toBe(true);
    const removed = diff.lineChanges.find((c) => c.type === "removed");
    expect(removed?.description).toBe("旧オプション");
    expect(removed?.prevAmount).toBe(5000);
    expect(removed?.currAmount).toBeNull();
  });

  it("computes totals correctly for multi-line invoices", () => {
    const prev = [line("A", 2, 50000), line("B", 3, 10000)];
    const curr = [line("A", 2, 60000), line("B", 3, 10000)];
    const diff = computeInvoiceDiff(prev, curr);

    expect(diff.prevTotal).toBe(130000);
    expect(diff.currTotal).toBe(150000);
    expect(diff.amountChanged).toBe(true);
  });

  it("handles quantity changes on matched description", () => {
    const prev = [line("開発支援", 10, 10000)];
    const curr = [line("開発支援", 12, 10000)];
    const diff = computeInvoiceDiff(prev, curr);

    expect(diff.lineChanges[0]?.type).toBe("changed");
    expect(diff.lineChanges[0]?.prevAmount).toBe(100000);
    expect(diff.lineChanges[0]?.currAmount).toBe(120000);
  });

  it("handles empty prev lines (all added)", () => {
    const diff = computeInvoiceDiff([], [line("初回", 1, 50000)]);

    expect(diff.prevTotal).toBe(0);
    expect(diff.currTotal).toBe(50000);
    expect(diff.lineChanges[0]?.type).toBe("added");
  });

  it("handles empty curr lines (all removed)", () => {
    const diff = computeInvoiceDiff([line("廃止項目", 1, 50000)], []);

    expect(diff.currTotal).toBe(0);
    expect(diff.lineChanges[0]?.type).toBe("removed");
  });
});

describe("prevMonth", () => {
  it("returns December of previous year when given January", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("returns previous month in same year", () => {
    expect(prevMonth("2026-07")).toBe("2026-06");
  });

  it("pads single digit months", () => {
    expect(prevMonth("2026-10")).toBe("2026-09");
  });
});
