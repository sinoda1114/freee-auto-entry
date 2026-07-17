import { describe, expect, it } from "vitest";
import { estimateConsumptionTaxMethods } from "./consumption-tax-estimate";

describe("estimateConsumptionTaxMethods", () => {
  it("favors simplified when purchase rate is high relative to actual purchases", () => {
    const result = estimateConsumptionTaxMethods({
      taxableSales: 10_000_000,
      taxablePurchases: 1_000_000,
      simplifiedPurchaseRate: 0.5,
      taxIncluded: false,
      taxRate: 0.1,
    });

    // output 1,000,000; principle input 100,000 → payable 900,000
    // simplified deduction 500,000 → payable 500,000
    expect(result.outputTax).toBe(1_000_000);
    expect(result.principlePayable).toBe(900_000);
    expect(result.simplifiedPayable).toBe(500_000);
    expect(result.advantage).toBe("simplified");
    expect(result.summaryJa).toContain("簡易課税");
  });

  it("favors principle when purchases are large", () => {
    const result = estimateConsumptionTaxMethods({
      taxableSales: 10_000_000,
      taxablePurchases: 8_000_000,
      simplifiedPurchaseRate: 0.5,
      taxIncluded: false,
      taxRate: 0.1,
    });
    expect(result.principlePayable).toBe(200_000);
    expect(result.simplifiedPayable).toBe(500_000);
    expect(result.advantage).toBe("principle");
  });

  it("handles tax-included amounts", () => {
    const result = estimateConsumptionTaxMethods({
      taxableSales: 1_100_000,
      taxablePurchases: 0,
      simplifiedPurchaseRate: 0.5,
      taxIncluded: true,
      taxRate: 0.1,
    });
    expect(result.outputTax).toBe(100_000);
    expect(result.assumptions.some((line) => line.includes("税込"))).toBe(true);
  });
});
