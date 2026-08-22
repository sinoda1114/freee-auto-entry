import { fireEvent, render, screen } from "@/test/test-utils";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AiConsultationWidget } from "./AiConsultationWidget";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AiConsultationWidget panel resize", () => {
  afterEach(() => {
    localStorage.removeItem("freee-ai-consultation-panel-size");
    sessionStorage.clear();
  });

  it("exposes drag handles and resizes width when dragging the left edge", () => {
    render(<AiConsultationWidget companyId="11122591" />);

    fireEvent.click(screen.getByRole("button", { name: "AIに相談する" }));

    const shell = screen.getByTestId("ai-consultation-shell");
    expect(shell).toHaveStyle({ width: "480px", height: "420px" });

    const widthHandle = screen.getByRole("separator", { name: "幅を変更" });
    fireEvent.pointerDown(widthHandle, {
      clientX: 100,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 40,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(shell).toHaveStyle({ width: "540px" });
    expect(
      JSON.parse(localStorage.getItem("freee-ai-consultation-panel-size")!),
    ).toMatchObject({ width: 540 });
  });

  it("hides resize handles in fullscreen", () => {
    render(<AiConsultationWidget companyId="11122591" />);
    fireEvent.click(screen.getByRole("button", { name: "AIに相談する" }));
    fireEvent.click(screen.getByRole("button", { name: /全画面/ }));

    expect(
      screen.queryByRole("separator", { name: "幅を変更" }),
    ).not.toBeInTheDocument();
  });

  it("reopens the FAB when a dock message arrives from popout", () => {
    render(<AiConsultationWidget companyId="11122591" />);

    expect(
      screen.queryByRole("dialog", { name: "AIに相談する" }),
    ).not.toBeInTheDocument();

    fireEvent(
      window,
      new MessageEvent("message", {
        data: { type: "freee-ai-consultation-dock" },
        origin: window.location.origin,
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "AIに相談する" }),
    ).toBeInTheDocument();
  });
});
