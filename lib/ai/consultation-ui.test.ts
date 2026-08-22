import { afterEach, describe, expect, it } from "vitest";
import {
  CONSULTATION_FONT_SIZE_DEFAULT,
  CONSULTATION_FONT_SIZE_MAX,
  CONSULTATION_FONT_SIZE_MIN,
  clampConsultationFontSize,
  loadConsultationFontSize,
  saveConsultationFontSize,
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
