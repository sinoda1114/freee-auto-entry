/** Generate a unique-enough invoice number when freee auto-numbering is off. */
export function generateInvoiceNumber(input: {
  billingDate: string;
  partnerId: number;
  suffix?: string;
}): string {
  const ymd = input.billingDate.replace(/-/g, "");
  const partner = String(input.partnerId);
  const suffix =
    input.suffix?.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 12) ||
    Date.now().toString(36).slice(-4);
  return `${ymd}-${partner}-${suffix}`;
}

export function isInvoiceNumberRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("invoice_number") &&
    (error.message.includes("必須") ||
      error.message.includes("自動採番が無効"))
  );
}
