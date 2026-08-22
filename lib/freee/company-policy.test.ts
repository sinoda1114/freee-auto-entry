import { afterEach, describe, expect, it } from "vitest";
import {
  getExpenseCompanyId,
  getExpenseCompanyIds,
  isExpenseCompany,
} from "./company-policy";

describe("company-policy", () => {
  afterEach(() => {
    delete process.env.FREEE_EXPENSE_COMPANY_ID;
    delete process.env.FREEE_EXPENSE_COMPANY_IDS;
  });

  it("defaults expense companies to Waalsforce and Shinoda IT", () => {
    expect(getExpenseCompanyIds()).toEqual(["11122591", "11040830"]);
    expect(getExpenseCompanyId()).toBe("11122591");
    expect(isExpenseCompany("11122591")).toBe(true);
    expect(isExpenseCompany("11040830")).toBe(true);
    expect(isExpenseCompany("99999999")).toBe(false);
  });

  it("accepts a single FREEE_EXPENSE_COMPANY_ID", () => {
    process.env.FREEE_EXPENSE_COMPANY_ID = "12345";
    expect(getExpenseCompanyIds()).toEqual(["12345"]);
    expect(isExpenseCompany("12345")).toBe(true);
    expect(isExpenseCompany("11122591")).toBe(false);
  });

  it("accepts comma-separated FREEE_EXPENSE_COMPANY_IDS", () => {
    process.env.FREEE_EXPENSE_COMPANY_IDS = "11122591, 11040830, 999";
    expect(getExpenseCompanyIds()).toEqual(["11122591", "11040830", "999"]);
    expect(isExpenseCompany("999")).toBe(true);
  });

  it("prefers FREEE_EXPENSE_COMPANY_IDS over FREEE_EXPENSE_COMPANY_ID", () => {
    process.env.FREEE_EXPENSE_COMPANY_ID = "11122591";
    process.env.FREEE_EXPENSE_COMPANY_IDS = "11040830";
    expect(getExpenseCompanyIds()).toEqual(["11040830"]);
  });
});
