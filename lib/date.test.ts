import { describe, expect, it } from "vitest";
import { formatTokyoDate, formatTokyoMonth } from "./date";

describe("Tokyo business date", () => {
  it("uses the next calendar day after midnight in Japan", () => {
    const date = new Date("2026-07-31T15:30:00.000Z");

    expect(formatTokyoDate(date)).toBe("2026-08-01");
    expect(formatTokyoMonth(date)).toBe("2026-08");
  });
});
