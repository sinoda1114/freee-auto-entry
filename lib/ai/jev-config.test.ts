import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_JEV_MIN_CONFIDENCE,
  getJevApiKey,
  getJevMinConfidence,
  isJevConfidenceHigh,
  isJevEnabled,
} from "./jev-config";

describe("jev config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays off without the flag or a key", () => {
    vi.stubEnv("JEV_ENABLED", "");
    vi.stubEnv("JEV_API_KEY", "");
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("E2E_TEST_MODE", "");
    expect(isJevEnabled()).toBe(false);
  });

  it("stays off when the flag is on but no key is set", () => {
    vi.stubEnv("JEV_ENABLED", "1");
    vi.stubEnv("JEV_API_KEY", "");
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("E2E_TEST_MODE", "");
    expect(isJevEnabled()).toBe(false);
  });

  it("turns on when the flag and a key are set", () => {
    vi.stubEnv("JEV_ENABLED", "1");
    vi.stubEnv("JEV_API_KEY", "test-key");
    vi.stubEnv("E2E_TEST_MODE", "");
    expect(isJevEnabled()).toBe(true);
    expect(getJevApiKey()).toBe("test-key");
  });

  it("stays off in E2E even with flag and key", () => {
    vi.stubEnv("JEV_ENABLED", "1");
    vi.stubEnv("JEV_API_KEY", "test-key");
    vi.stubEnv("E2E_TEST_MODE", "1");
    expect(isJevEnabled()).toBe(false);
  });

  it("reads the confidence gate and rejects low scores", () => {
    vi.stubEnv("JEV_MIN_CONFIDENCE", "0.75");
    expect(getJevMinConfidence()).toBe(0.75);
    expect(isJevConfidenceHigh(0.74, 0.75)).toBe(false);
    expect(isJevConfidenceHigh(0.75, 0.75)).toBe(true);
  });

  it("falls back to the default confidence when the env is invalid", () => {
    vi.stubEnv("JEV_MIN_CONFIDENCE", "nope");
    expect(getJevMinConfidence()).toBe(DEFAULT_JEV_MIN_CONFIDENCE);
  });
});
