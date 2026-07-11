import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySwitcher } from "./CompanySwitcher";

const switchCompanyActionMock = vi.fn();

vi.mock("./company-actions", () => ({
  switchCompanyAction: (...args: unknown[]) => switchCompanyActionMock(...args),
}));

const companies = [
  { companyId: "111", companyName: "Company One" },
  { companyId: "222", companyName: "Company Two" },
];

describe("CompanySwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables the selector while switching", async () => {
    let resolveAction: ((value: { status: "switched" }) => void) | undefined;
    switchCompanyActionMock.mockReturnValue(
      new Promise<{ status: "switched" }>((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <CompanySwitcher companies={companies} activeCompanyId="111" />,
    );

    const selector = screen.getByRole("combobox", {
      name: "事業所を切り替え:",
    });
    const selection = user.selectOptions(selector, "222");

    await vi.waitFor(() => expect(selector).toBeDisabled());
    resolveAction?.({ status: "switched" });
    await selection;
    await vi.waitFor(() => expect(selector).toBeEnabled());
  });

  it("restores the active company and shows an error when switching fails", async () => {
    switchCompanyActionMock.mockResolvedValue({ status: "not-connected" });
    const user = userEvent.setup();
    render(
      <CompanySwitcher companies={companies} activeCompanyId="111" />,
    );

    const selector = screen.getByRole("combobox", {
      name: "事業所を切り替え:",
    });
    await user.selectOptions(selector, "222");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "事業所を切り替えられませんでした",
    );
    expect(selector).toHaveValue("111");
  });
});
