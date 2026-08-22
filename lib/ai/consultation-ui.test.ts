import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_CONSULTATION_POPOUT_NAME,
  AI_CONSULTATION_POPOUT_PATH,
  CONSULTATION_FONT_SIZE_DEFAULT,
  CONSULTATION_FONT_SIZE_MAX,
  CONSULTATION_FONT_SIZE_MIN,
  CONSULTATION_PANEL_HEIGHT_MIN,
  CONSULTATION_PANEL_WIDTH_MIN,
  clampConsultationFontSize,
  clampConsultationPanelSize,
  loadConsultationFontSize,
  loadConsultationPanelSize,
  openAiConsultationPopout,
  saveConsultationFontSize,
  saveConsultationPanelSize,
} from "./consultation-ui";

describe("consultation font size", () => {
  afterEach(() => {
    localStorage.removeItem("freee-ai-consultation-font-size");
  });

  it("clamps to the allowed range", () => {
    expect(clampConsultationFontSize(10)).toBe(CONSULTATION_FONT_SIZE_MIN);
    expect(clampConsultationFontSize(30)).toBe(CONSULTATION_FONT_SIZE_MAX);
    expect(clampConsultationFontSize(17.4)).toBe(17);
    expect(clampConsultationFontSize(Number.NaN)).toBe(
      CONSULTATION_FONT_SIZE_DEFAULT,
    );
  });

  it("defaults when nothing is stored", () => {
    expect(loadConsultationFontSize()).toBe(CONSULTATION_FONT_SIZE_DEFAULT);
  });

  it("persists and reloads the selected size", () => {
    saveConsultationFontSize(18);
    expect(loadConsultationFontSize()).toBe(18);
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("freee-ai-consultation-font-size", "not-a-number");
    expect(loadConsultationFontSize()).toBe(CONSULTATION_FONT_SIZE_DEFAULT);
  });
});

describe("consultation panel size", () => {
  afterEach(() => {
    localStorage.removeItem("freee-ai-consultation-panel-size");
  });

  it("clamps width and height to viewport-aware bounds", () => {
    expect(
      clampConsultationPanelSize(
        { width: 100, height: 50 },
        { width: 1000, height: 800 },
      ),
    ).toEqual({
      width: CONSULTATION_PANEL_WIDTH_MIN,
      height: CONSULTATION_PANEL_HEIGHT_MIN,
    });

    expect(
      clampConsultationPanelSize(
        { width: 9000, height: 9000 },
        { width: 1000, height: 800 },
      ),
    ).toEqual({
      width: 968,
      height: 696,
    });
  });

  it("persists and reloads panel size", () => {
    saveConsultationPanelSize({ width: 520, height: 360 });
    expect(loadConsultationPanelSize()).toEqual({ width: 520, height: 360 });
  });
});

describe("openAiConsultationPopout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens a named popup with panel size", () => {
    const focus = vi.fn();
    const open = vi.fn(() => ({ focus }));
    vi.stubGlobal("open", open);
    Object.defineProperty(window, "screenLeft", { value: 0, configurable: true });
    Object.defineProperty(window, "screenTop", { value: 0, configurable: true });
    Object.defineProperty(window, "outerWidth", {
      value: 1200,
      configurable: true,
    });
    Object.defineProperty(window, "outerHeight", {
      value: 800,
      configurable: true,
    });

    openAiConsultationPopout({ width: 500, height: 400 });

    expect(open).toHaveBeenCalledWith(
      AI_CONSULTATION_POPOUT_PATH,
      AI_CONSULTATION_POPOUT_NAME,
      expect.stringMatching(/width=500.*height=400|height=400.*width=500/),
    );
    const features = String(open.mock.calls.at(0)?.at(2) ?? "");
    expect(features).toContain("popup=yes");
    expect(focus).toHaveBeenCalled();
  });
});
