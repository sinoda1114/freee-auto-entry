import { describe, expect, it } from "vitest";
import { isReceiptDropFile } from "./receipt-file";

describe("isReceiptDropFile", () => {
  it("accepts images and PDFs", () => {
    expect(isReceiptDropFile({ type: "image/jpeg" })).toBe(true);
    expect(isReceiptDropFile({ type: "image/png" })).toBe(true);
    expect(isReceiptDropFile({ type: "application/pdf" })).toBe(true);
  });

  it("rejects other files", () => {
    expect(isReceiptDropFile({ type: "text/csv" })).toBe(false);
    expect(isReceiptDropFile({ type: "video/mp4" })).toBe(false);
  });
});
