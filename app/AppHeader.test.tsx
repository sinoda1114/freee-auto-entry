import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("links to the core accounting and invoice workflows", () => {
    render(<AppHeader />);

    expect(screen.getByRole("link", { name: "未処理明細" })).toHaveAttribute(
      "href",
      "/wallet-txns",
    );
    expect(screen.getByRole("link", { name: "定型請求" })).toHaveAttribute(
      "href",
      "/recurring-invoices",
    );
    expect(screen.getByRole("link", { name: "請求書" })).toHaveAttribute(
      "href",
      "/invoices",
    );
  });
});
