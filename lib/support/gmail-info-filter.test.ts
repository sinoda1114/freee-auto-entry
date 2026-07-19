import { describe, expect, it } from "vitest";
import {
  extractEmbeddedThreadId,
  isInformationalSupportMail,
} from "./gmail-info-filter";

describe("isInformationalSupportMail", () => {
  it("excludes important notices", () => {
    expect(
      isInformationalSupportMail({
        subject: "【freeeより重要なお知らせ】メンテナンスのお知らせ",
        from: '"freeeサポートデスク" <support@freee.co.jp>',
      }),
    ).toBe(true);
  });

  it("keeps inquiry history transcripts", () => {
    expect(
      isInformationalSupportMail({
        subject: "【freeeサポートデスク】お問い合わせ履歴を送信させていただきます",
        from: '"freeeサポート" <support@freee.co.jp>',
      }),
    ).toBe(false);
  });

  it("keeps real support replies", () => {
    expect(
      isInformationalSupportMail({
        subject: "Re: you: 利用可能枠が未だあるのに決済できない",
        from: '"freeeサポート" <support@freee.co.jp>',
      }),
    ).toBe(false);
  });
});

describe("extractEmbeddedThreadId", () => {
  it("parses freee thread markers", () => {
    expect(
      extractEmbeddedThreadId(
        "Re: 急ぎ！！！！回答がないです [ thread::tKI_L7IrfXSSSJPp4ZNo1gQ:: ]",
      ),
    ).toBe("tKI_L7IrfXSSSJPp4ZNo1gQ");
  });
});
