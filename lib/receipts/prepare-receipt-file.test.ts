import { describe, expect, it } from "vitest";
import {
  RECEIPT_UPLOAD_MAX_BYTES,
  formatMegabytes,
  isReceiptFileTooLarge,
  receiptTooLargeMessage,
} from "./prepare-receipt-file";

describe("formatMegabytes", () => {
  it("formats bytes as MB with one decimal", () => {
    expect(formatMegabytes(6 * 1024 * 1024)).toBe("6.0MB");
  });
});

describe("isReceiptFileTooLarge", () => {
  it("never blocks images (they can be compressed)", () => {
    expect(
      isReceiptFileTooLarge({
        size: 8 * 1024 * 1024,
        type: "image/jpeg",
      }),
    ).toBe(false);
  });

  it("blocks PDFs over the upload max", () => {
    expect(
      isReceiptFileTooLarge({
        size: RECEIPT_UPLOAD_MAX_BYTES + 1,
        type: "application/pdf",
      }),
    ).toBe(true);
  });

  it("allows PDFs within the upload max", () => {
    expect(
      isReceiptFileTooLarge({
        size: RECEIPT_UPLOAD_MAX_BYTES,
        type: "application/pdf",
      }),
    ).toBe(false);
  });
});

describe("receiptTooLargeMessage", () => {
  it("mentions the actual size", () => {
    const message = receiptTooLargeMessage({
      size: 6 * 1024 * 1024,
      type: "application/pdf",
    });
    expect(message).toContain("6.0MB");
    expect(message).toContain("3.5MB");
  });
});
