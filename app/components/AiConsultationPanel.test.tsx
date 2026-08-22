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

  it("shows a horizontal font size slider", () => {
    render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    const slider = screen.getByRole("slider", { name: "文字サイズ" });
    expect(slider).toHaveAttribute("min", "14");
    expect(slider).toHaveAttribute("max", "20");
    expect(slider).toHaveValue(String(CONSULTATION_FONT_SIZE_DEFAULT));
  });

  it("applies stored font size to the panel CSS variable", () => {
    saveConsultationFontSize(18);

    const { container } = render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveStyle({
      "--ai-chat-font-size": "18px",
    });
    expect(screen.getByRole("slider", { name: "文字サイズ" })).toHaveValue(
      "18",
    );
  });

  it("updates the CSS variable when the slider changes", () => {
    const { container } = render(
      <AiConsultationPanel
        companyId="11122591"
        viewMode="compact"
        onViewModeChange={() => {}}
      />,
    );

    const slider = screen.getByRole("slider", { name: "文字サイズ" });
    fireEvent.change(slider, { target: { value: "20" } });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveStyle({
      "--ai-chat-font-size": "20px",
    });
    expect(localStorage.getItem("freee-ai-consultation-font-size")).toBe("20");
  });
});
