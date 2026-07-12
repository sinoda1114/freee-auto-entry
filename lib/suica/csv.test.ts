import { describe, expect, it } from "vitest";
import { parseCsvRows, parseSuicaCsv } from "./csv";

describe("parseCsvRows", () => {
  it("handles quoted commas", () => {
    expect(parseCsvRows('a,"b,c",d\n1,2,3')).toEqual([
      ["a", "b,c", "d"],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseSuicaCsv", () => {
  it("parses headered fare rows and skips charge", () => {
    const csv = [
      "利用日,種別,入場,出場,金額,残高",
      "2024/07/12,運賃,東京,品川,180,1000",
      "2024/07/11,運賃,新宿,渋谷,160,1180",
      "2024/07/10,チャージ,,,1000,2000",
    ].join("\n");

    const items = parseSuicaCsv(csv);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      date: "2024-07-12",
      amount: 180,
      description: expect.stringContaining("東京→品川"),
    });
    expect(items[1]?.amount).toBe(160);
  });

  it("parses negative amount as expense", () => {
    const csv = [
      "日付,利用内容,金額,残高",
      "2024-07-12,電車 横浜→川崎,-210,5000",
    ].join("\n");
    const items = parseSuicaCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]?.amount).toBe(210);
  });

  it("accepts BOM", () => {
    const csv = "\uFEFF日付,金額\n2024/01/02,100\n";
    expect(parseSuicaCsv(csv)[0]?.date).toBe("2024-01-02");
  });
});
