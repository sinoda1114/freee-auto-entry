import { describe, expect, it } from "vitest";
import { getExpenseCompanyId, isExpenseCompany } from "./company-policy";

describe("company-policy", () => {
  it("defaults expense company to Waalsforce", () => {
    expect(getExpenseCompanyId()).toBe("11122591");
    expect(isExpenseCompany("11122591")).toBe(true);
    expect(isExpenseCompany("11040830")).toBe(false);
  });
});
