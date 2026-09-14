import { describe, expect, it } from "vitest";
import {
  buildSuicaExpenseUrl,
  decodeSuicaHandoffPayload,
  encodeSuicaHandoffPayload,
  hexToBytes,
  parseSuicaHistoryBlock,
  parseSuicaHistoryBlocks,
  pickTravelAccountItemId,
  toTransitItems,
} from "./history";

/** 合成ブロック: 2024-07-12 / 運賃 / 入場0x0A01 出場0x0B02 / 残額1000 */
function makeBlock(opts: {
  processType: number;
  year: number;
  month: number;
  day: number;
  entrance: number;
  exit: number;
  balance: number;
  sequence?: number;
}): Uint8Array {
  const y = opts.year - 2000;
  const dateWord = (y << 9) | (opts.month << 5) | opts.day;
  const block = new Uint8Array(16);
  block[0] = 0x16;
  block[1] = opts.processType;
  block[4] = (dateWord >> 8) & 0xff;
  block[5] = dateWord & 0xff;
  block[6] = (opts.entrance >> 8) & 0xff;
  block[7] = opts.entrance & 0xff;
  block[8] = (opts.exit >> 8) & 0xff;
  block[9] = opts.exit & 0xff;
  block[10] = opts.balance & 0xff;
  block[11] = (opts.balance >> 8) & 0xff;
  const seq = (opts.sequence ?? 1) << 4;
  block[13] = (seq >> 8) & 0xff;
  block[14] = seq & 0xff;
  return block;
}

describe("parseSuicaHistoryBlock", () => {
  it("parses date, stations, and little-endian balance", () => {
    const block = makeBlock({
      processType: 0x01,
      year: 2024,
      month: 7,
      day: 12,
      entrance: 0x0a01,
      exit: 0x0b02,
      balance: 1000,
    });
    const record = parseSuicaHistoryBlock(block);
    expect(record).toMatchObject({
      date: "2024-07-12",
      processType: 0x01,
      entranceCode: 0x0a01,
      exitCode: 0x0b02,
      balance: 1000,
    });
  });

  it("returns null for empty blocks", () => {
    expect(parseSuicaHistoryBlock(new Uint8Array(16))).toBeNull();
  });

  it("parses concatenated history bytes", () => {
    const a = makeBlock({
      processType: 0x01,
      year: 2024,
      month: 7,
      day: 12,
      entrance: 1,
      exit: 2,
      balance: 1000,
    });
    const b = makeBlock({
      processType: 0x01,
      year: 2024,
      month: 7,
      day: 11,
      entrance: 3,
      exit: 4,
      balance: 1180,
    });
    const data = new Uint8Array(32);
    data.set(a, 0);
    data.set(b, 16);
    expect(parseSuicaHistoryBlocks(data)).toHaveLength(2);
  });
});

describe("toTransitItems", () => {
  it("computes fare from balance delta and skips charge", () => {
    const newer = parseSuicaHistoryBlock(
      makeBlock({
        processType: 0x01,
        year: 2024,
        month: 7,
        day: 12,
        entrance: 0x0100,
        exit: 0x0200,
        balance: 1000,
      }),
    )!;
    const older = parseSuicaHistoryBlock(
      makeBlock({
        processType: 0x01,
        year: 2024,
        month: 7,
        day: 11,
        entrance: 0x0300,
        exit: 0x0400,
        balance: 1180,
      }),
    )!;
    const charge = parseSuicaHistoryBlock(
      makeBlock({
        processType: 0x02,
        year: 2024,
        month: 7,
        day: 10,
        entrance: 0,
        exit: 0,
        balance: 2000,
      }),
    )!;

    const items = toTransitItems([newer, older, charge]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      date: "2024-07-12",
      amount: 180,
      description: expect.stringContaining("運賃"),
    });
    expect(items[1]).toMatchObject({
      date: "2024-07-11",
      amount: 820,
    });
  });
});

describe("handoff payload", () => {
  it("round-trips encode/decode", () => {
    const payload = {
      v: 1 as const,
      items: [
        {
          date: "2024-07-12",
          amount: 180,
          balance: 1000,
          processType: 1,
          entranceCode: 256,
          exitCode: 512,
          region: 0,
          sequence: 1,
          description: "Suica 運賃 駅0100→駅0200",
        },
      ],
    };
    const encoded = encodeSuicaHandoffPayload(payload);
    expect(decodeSuicaHandoffPayload(encoded)).toEqual(payload);
  });

  it("builds expense URL with site base", () => {
    const url = buildSuicaExpenseUrl("https://example.com/", [
      {
        date: "2024-07-12",
        amount: 180,
        balance: 1000,
        processType: 1,
        entranceCode: 1,
        exitCode: 2,
        region: 0,
        sequence: 1,
        description: "test",
      },
    ]);
    expect(url.startsWith("https://example.com/expenses/suica?p=")).toBe(true);
    const p = new URL(url).searchParams.get("p")!;
    expect(decodeSuicaHandoffPayload(p).items[0]?.amount).toBe(180);
  });

  it("hex helper matches parser", () => {
    const block = makeBlock({
      processType: 0x01,
      year: 2025,
      month: 1,
      day: 2,
      entrance: 10,
      exit: 20,
      balance: 500,
    });
    const hex = Array.from(block)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(parseSuicaHistoryBlock(hexToBytes(hex))?.balance).toBe(500);
  });
});

describe("pickTravelAccountItemId", () => {
  it("prefers travel-like account names", () => {
    expect(
      pickTravelAccountItemId([
        { id: 1, name: "消耗品費" },
        { id: 2, name: "旅費交通費" },
      ]),
    ).toBe(2);
  });

  it("returns null when no travel-like account matches", () => {
    expect(
      pickTravelAccountItemId([
        { id: 1, name: "売上高" },
        { id: 2, name: "仕入高" },
      ]),
    ).toBeNull();
  });
});
