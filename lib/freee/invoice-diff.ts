export interface InvoiceLineSnapshot {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export type LineChangeType = "same" | "changed" | "added" | "removed";

export interface LineChange {
  type: LineChangeType;
  description: string;
  prevAmount: number | null;
  currAmount: number | null;
  prevLine: InvoiceLineSnapshot | null;
  currLine: InvoiceLineSnapshot | null;
}

export interface InvoiceDiff {
  prevTotal: number;
  currTotal: number;
  amountChanged: boolean;
  lineCountChanged: boolean;
  lineChanges: LineChange[];
  hasAnyChange: boolean;
}

function lineSubtotal(line: InvoiceLineSnapshot): number {
  return line.quantity * line.unitPrice;
}

function linesEqual(a: InvoiceLineSnapshot, b: InvoiceLineSnapshot): boolean {
  return (
    a.description === b.description &&
    a.quantity === b.quantity &&
    a.unitPrice === b.unitPrice &&
    a.taxRate === b.taxRate
  );
}

/**
 * Computes a structured diff between a previous invoice's lines and the current
 * template lines. Matching is done by description (position-independent).
 * Pure function with no side effects.
 */
export function computeInvoiceDiff(
  prevLines: InvoiceLineSnapshot[],
  currLines: InvoiceLineSnapshot[],
): InvoiceDiff {
  const prevTotal = prevLines.reduce((sum, l) => sum + lineSubtotal(l), 0);
  const currTotal = currLines.reduce((sum, l) => sum + lineSubtotal(l), 0);

  const lineChanges: LineChange[] = [];
  const usedPrevIndices = new Set<number>();
  const usedCurrIndices = new Set<number>();

  // First pass: exact matches by description + values
  for (let ci = 0; ci < currLines.length; ci++) {
    const curr = currLines[ci]!;
    const pi = prevLines.findIndex(
      (p, idx) => !usedPrevIndices.has(idx) && linesEqual(p, curr),
    );
    if (pi !== -1) {
      usedPrevIndices.add(pi);
      usedCurrIndices.add(ci);
      lineChanges.push({
        type: "same",
        description: curr.description,
        prevAmount: lineSubtotal(prevLines[pi]!),
        currAmount: lineSubtotal(curr),
        prevLine: prevLines[pi]!,
        currLine: curr,
      });
    }
  }

  // Second pass: match by description only (changed values)
  for (let ci = 0; ci < currLines.length; ci++) {
    if (usedCurrIndices.has(ci)) continue;
    const curr = currLines[ci]!;
    const pi = prevLines.findIndex(
      (p, idx) =>
        !usedPrevIndices.has(idx) && p.description === curr.description,
    );
    if (pi !== -1) {
      usedPrevIndices.add(pi);
      usedCurrIndices.add(ci);
      lineChanges.push({
        type: "changed",
        description: curr.description,
        prevAmount: lineSubtotal(prevLines[pi]!),
        currAmount: lineSubtotal(curr),
        prevLine: prevLines[pi]!,
        currLine: curr,
      });
    }
  }

  // Remaining prev lines: removed
  for (let pi = 0; pi < prevLines.length; pi++) {
    if (!usedPrevIndices.has(pi)) {
      const prev = prevLines[pi]!;
      lineChanges.push({
        type: "removed",
        description: prev.description,
        prevAmount: lineSubtotal(prev),
        currAmount: null,
        prevLine: prev,
        currLine: null,
      });
    }
  }

  // Remaining curr lines: added
  for (let ci = 0; ci < currLines.length; ci++) {
    if (!usedCurrIndices.has(ci)) {
      const curr = currLines[ci]!;
      lineChanges.push({
        type: "added",
        description: curr.description,
        prevAmount: null,
        currAmount: lineSubtotal(curr),
        prevLine: null,
        currLine: curr,
      });
    }
  }

  const amountChanged = prevTotal !== currTotal;
  const lineCountChanged = prevLines.length !== currLines.length;
  const hasAnyChange =
    amountChanged ||
    lineCountChanged ||
    lineChanges.some((c) => c.type !== "same");

  return {
    prevTotal,
    currTotal,
    amountChanged,
    lineCountChanged,
    lineChanges,
    hasAnyChange,
  };
}

export function prevMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}
