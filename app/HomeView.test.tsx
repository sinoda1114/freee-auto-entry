import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";
import { HomeDashboard } from "./HomeView";

describe("HomeDashboard", () => {
  it("shows support history as an independent workflow group", () => {
    render(<HomeDashboard canRegisterExpense={false} />);

    const supportHeading = screen.getByRole("heading", {
      name: "問い合わせ",
    });
    const supportSection = supportHeading.closest("section");

    expect(supportSection).not.toBeNull();
    if (!supportSection) {
      throw new Error("問い合わせセクションが見つかりません。");
    }
    expect(
      within(supportSection).getByRole("link", {
        name: /問い合わせ履歴/,
      }),
    ).toHaveAttribute("href", "/support");

    const accountingHeading = screen.getByRole("heading", { name: "経理" });
    const accountingSection = accountingHeading.closest("section");
    if (!accountingSection) {
      throw new Error("経理セクションが見つかりません。");
    }
    expect(
      within(accountingSection).queryByRole("link", {
        name: /問い合わせ履歴/,
      }),
    ).not.toBeInTheDocument();
  });
});
