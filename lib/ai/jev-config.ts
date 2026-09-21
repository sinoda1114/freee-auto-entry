import { isE2ETestMode } from "@/lib/e2e/fixtures";

export const DEFAULT_JEV_BASE_URL = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_JEV_MODEL = "jev-latest";
export const DEFAULT_JEV_MIN_CONFIDENCE = 0.6;
/** TypeSafe Choice の上限は 255。要件は常に 255 未満。 */
export const MAX_JEV_CHOICES = 254;
export const JEV_FETCH_TIMEOUT_MS = 8_000;

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

export function getJevApiKey(): string | undefined {
  return firstNonEmpty(
    process.env.JEV_API_KEY,
    process.env.TYPESAFE_API_KEY,
    process.env.AI_GATEWAY_API_KEY,
  );
}

export function getJevBaseUrl(): string {
  return firstNonEmpty(process.env.JEV_BASE_URL) ?? DEFAULT_JEV_BASE_URL;
}

export function getJevModel(): string {
  return firstNonEmpty(process.env.JEV_MODEL) ?? DEFAULT_JEV_MODEL;
}

export function getJevMinConfidence(): number {
  const raw = process.env.JEV_MIN_CONFIDENCE?.trim();
  if (!raw) {
    return DEFAULT_JEV_MIN_CONFIDENCE;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_JEV_MIN_CONFIDENCE;
  }
  return parsed;
}

export function isJevEnabled(): boolean {
  if (isE2ETestMode()) {
    return false;
  }
  return isTruthyEnv(process.env.JEV_ENABLED) && Boolean(getJevApiKey());
}

export function isJevConfidenceHigh(
  confidence: number,
  minConfidence = getJevMinConfidence(),
): boolean {
  return Number.isFinite(confidence) && confidence >= minConfidence;
}

export function isWithinJevChoiceLimit(count: number): boolean {
  return count > 0 && count <= MAX_JEV_CHOICES;
}
