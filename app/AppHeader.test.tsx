import { Navbar, NavbarContent } from "@heroui/react";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";
import { HeaderNav } from "./HeaderNav";

describe("AppHeader", () => {
  it("links to the core accounting and invoice workflows", () => {
    render(
      <Navbar>
        <NavbarContent>
          <HeaderNav />
        </NavbarContent>
      </Navbar>,
    );

    expect(screen.getByRole("link", { name: "月次" })).toHaveAttribute(
      "href",
      "/monthly-close",
    );
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
    expect(screen.queryByRole("link", { name: "経費" })).not.toBeInTheDocument();
  });

  it("includes expense registration when the active company allows it", () => {
    render(
      <Navbar>
        <NavbarContent>
          <HeaderNav canRegisterExpense />
        </NavbarContent>
      </Navbar>,
    );

    expect(screen.getByRole("link", { name: "経費" })).toHaveAttribute(
      "href",
      "/expenses/new",
    );
  });
});
