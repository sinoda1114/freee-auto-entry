import { describe, expect, it } from "vitest";
import {
  formatConsultationTargetLabel,
  parseConsultationTarget,
} from "./consultation-target";

describe("consultation target parser", () => {
  it("parses freee transfer URL hash", () => {
    expect(
      parseConsultationTarget(
        "https://secure.freee.co.jp/deals#code=transfer&deal_id=3137219490",
      ),
    ).toEqual({ kind: "transfer", id: 3137219490 });
  });

  it("parses wallet transaction id", () => {
    expect(
      parseConsultationTarget(
        "https://secure.freee.co.jp/wallet_txns/stream#wallet_txn_id=12345",
      ),
    ).toEqual({ kind: "wallet_txn", id: 12345 });
  });

  it("formats target labels", () => {
    expect(
      formatConsultationTargetLabel({ kind: "transfer", id: 3137219490 }),
    ).toBe("口座振替 #3137219490");
  });
});
