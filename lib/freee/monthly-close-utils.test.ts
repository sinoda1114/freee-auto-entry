import { describe, expect, test } from "vitest";
import {
  checklistStatus,
  currentTargetMonth,
  formatTargetMonth,
} from "./monthly-close-utils";

describe("currentTargetMonth", () => {
  test("2026-07-12 → '2026-07'", () => {
    expect(currentTargetMonth(new Date("2026-07-12"))).toBe("2026-07");
  });

  test("month is zero-padded", () => {
    expect(currentTargetMonth(new Date("2026-01-01"))).toBe("2026-01");
  });
});

describe("formatTargetMonth", () => {
  test("'2026-07' → '2026年7月'", () => {
    expect(formatTargetMonth("2026-07")).toBe("2026年7月");
  });

  test("leading zero stripped from month", () => {
    expect(formatTargetMonth("2026-01")).toBe("2026年1月");
  });
});

describe("checklistStatus", () => {
  test("全件 0 → clear", () => {
    expect(
      checklistStatus({
        unprocessedWalletTxns: 0,
        pendingTemplateCount: 0,
        unsentInvoiceCount: 0,
      }),
    ).toBe("clear");
  });

  test("未処理明細あり → action-required", () => {
    expect(
      checklistStatus({
        unprocessedWalletTxns: 3,
        pendingTemplateCount: 0,
        unsentInvoiceCount: 0,
      }),
    ).toBe("action-required");
  });

  test("送付待ちあり → action-required", () => {
    expect(
      checklistStatus({
        unprocessedWalletTxns: 0,
        pendingTemplateCount: 0,
        unsentInvoiceCount: 1,
      }),
    ).toBe("action-required");
  });
});
