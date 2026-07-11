import { describe, expect, it } from "vitest";
import {
  FREEE_WALLET_TXNS_LIST_URL,
  freeeWalletTxnStreamUrl,
  freeeWalletTxnStreamUrlFor,
} from "./wallet-url";

describe("freeeWalletTxnStreamUrl", () => {
  it("opens the automatic bookkeeping screen for a wallet transaction id", () => {
    expect(freeeWalletTxnStreamUrl(2297006598)).toBe(
      "https://secure.freee.co.jp/wallet_txns/stream#wallet_txn_id=2297006598",
    );
  });

  it("accepts a wallet transaction object", () => {
    expect(freeeWalletTxnStreamUrlFor({ id: 42 })).toBe(
      "https://secure.freee.co.jp/wallet_txns/stream#wallet_txn_id=42",
    );
  });

  it("exposes the wallet transaction list URL", () => {
    expect(FREEE_WALLET_TXNS_LIST_URL).toBe(
      "https://secure.freee.co.jp/wallet_txns",
    );
  });
});
