import { describe, expect, it } from "vitest";
import {
  detectConsultationIntent,
  extractAccountItemName,
  parseFiscalYearHint,
  resolveFiscalPeriod,
  shouldFetchReports,
} from "./consultation-intent";
import type { FiscalYear } from "@/lib/freee/company";

const fiscalYears: FiscalYear[] = [
  {
    id: 2,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    isClosed: false,
    taxAccountMethod: 0,
    taxMethod: 0,
  },
  {
    id: 1,
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    isClosed: true,
    taxAccountMethod: 0,
    taxMethod: 0,
  },
];

describe("parseFiscalYearHint", () => {
  it("parses 25年度 as 2025", () => {
    expect(parseFiscalYearHint("25年度の損益計算書")).toEqual({
      type: "year",
      year: 2025,
    });
  });

  it("parses 今期 / 前期", () => {
    expect(parseFiscalYearHint("今期の売上")).toEqual({ type: "current" });
    expect(parseFiscalYearHint("前期比較")).toEqual({ type: "previous" });
  });
});

describe("resolveFiscalPeriod", () => {
  it("resolves year hint to company fiscal dates", () => {
    const period = resolveFiscalPeriod(
      fiscalYears,
      { type: "year", year: 2025 },
      "2025-06-01",
    );
    expect(period).toEqual({
      label: "2025年度（2025-01-01〜2025-12-31）",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      fiscalYear: 2025,
    });
  });

  it("resolves previous period", () => {
    const period = resolveFiscalPeriod(
      fiscalYears,
      { type: "previous" },
      "2025-06-01",
    );
    expect(period?.startDate).toBe("2024-01-01");
  });
});

describe("detectConsultationIntent", () => {
  it("detects P&L questions without claiming no access", () => {
    const intent = detectConsultationIntent(
      "今ね、ちょっとすごく難しい質問なんだけど、25年度の損益計算書を見てもらうことは可能ですか？",
      false,
    );
    expect(intent.kind).toBe("report_pl");
    expect(intent.wantsPl).toBe(true);
    expect(intent.responseMode).toBe("present");
    expect(shouldFetchReports(intent)).toBe(true);
    expect(intent.fiscalHint).toEqual({ type: "year", year: 2025 });
  });

  it("uses present mode for simple display requests", () => {
    const intent = detectConsultationIntent("損益計算書を表示して", false);
    expect(intent.responseMode).toBe("present");
  });

  it("uses investigate mode when asking why", () => {
    const intent = detectConsultationIntent(
      "25年度の損益計算書で法人税がおかしい原因は？",
      false,
    );
    expect(intent.kind).toBe("report_pl");
    expect(intent.responseMode).toBe("investigate");
  });

  it("detects trial balance as both PL and BS", () => {
    const intent = detectConsultationIntent("今期の試算表を見せて", false);
    expect(intent.kind).toBe("report_both");
    expect(intent.wantsPl).toBe(true);
    expect(intent.wantsBs).toBe(true);
  });

  it("keeps record intent when a freee target is present", () => {
    const intent = detectConsultationIntent(
      "なぜこの振替が現金になっている？",
      true,
    );
    expect(intent.kind).toBe("record");
    expect(shouldFetchReports(intent)).toBe(false);
  });

  it("extracts known account names for ledger dig-down", () => {
    expect(extractAccountItemName("旅費交通費の内訳を教えて")).toBe(
      "旅費交通費",
    );
  });
});
