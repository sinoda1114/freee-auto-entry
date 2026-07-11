import { render, screen } from "@/test/test-utils";
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

async function selectCompany(name: string) {
  const user = userEvent.setup();
  const trigger = screen.getByLabelText("事業所を切り替え");
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name }));
}

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
    render(
      <CompanySwitcher companies={companies} activeCompanyId="111" />,
    );

    const trigger = screen.getByLabelText("事業所を切り替え");
    const selection = selectCompany("Company Two");

    await vi.waitFor(() => expect(trigger).toHaveAttribute("data-disabled", "true"));
    resolveAction?.({ status: "switched" });
    await selection;
    await vi.waitFor(() =>
      expect(trigger).not.toHaveAttribute("data-disabled", "true"),
    );
  });

  it("restores the active company and shows an error when switching fails", async () => {
    switchCompanyActionMock.mockResolvedValue({ status: "not-connected" });
    render(
      <CompanySwitcher companies={companies} activeCompanyId="111" />,
    );

    await selectCompany("Company Two");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "事業所を切り替えられませんでした",
    );
    expect(screen.getByLabelText("事業所を切り替え")).toHaveTextContent(
      "Company One",
    );
  });
});
