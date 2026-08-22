import { fireEvent, render, screen } from "@/test/test-utils";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AiConsultationPanel } from "./AiConsultationPanel";
import {
  CONSULTATION_FONT_SIZE_DEFAULT,
  saveConsultationFontSize,
} from "@/lib/ai/consultation-ui";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AiConsultationPanel font size", () => {
  afterEach(() => {
    localStorage.removeItem("freee-ai-consultation-font-size");
    sessionStorage.clear();
  });

  it("hides the font size slider until Aa is opened", async () => {
    render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    expect(screen.queryByRole("slider", { name: "文字サイズ" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /文字サイズ/ }),
    );

    const slider = screen.getByRole("slider", { name: "文字サイズ" });
    expect(slider).toHaveAttribute("min", "14");
    expect(slider).toHaveAttribute("max", "20");
    expect(slider).toHaveValue(String(CONSULTATION_FONT_SIZE_DEFAULT));
  });

  it("applies stored font size to chat content via inline style", () => {
    saveConsultationFontSize(18);

    const { container } = render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    const inputSection = container.querySelector(
      '[role="dialog"] > div:last-child',
    );
    expect(inputSection).toHaveStyle({ fontSize: "18px" });
  });

  it("updates font size when the vertical slider changes", () => {
    const { container } = render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /文字サイズ/ }));
    fireEvent.change(screen.getByRole("slider", { name: "文字サイズ" }), {
      target: { value: "20" },
    });

    const inputSection = container.querySelector(
      '[role="dialog"] > div:last-child',
    );
    expect(inputSection).toHaveStyle({ fontSize: "20px" });
    expect(localStorage.getItem("freee-ai-consultation-font-size")).toBe("20");
  });

  it("changes font size with wheel over the Aa control", () => {
    const { container } = render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    const aa = screen.getByRole("button", { name: /文字サイズ/ });
    fireEvent.wheel(aa, { deltaY: -100 });

    const inputSection = container.querySelector(
      '[role="dialog"] > div:last-child',
    );
    expect(inputSection).toHaveStyle({
      fontSize: `${CONSULTATION_FONT_SIZE_DEFAULT + 1}px`,
    });
  });
});
