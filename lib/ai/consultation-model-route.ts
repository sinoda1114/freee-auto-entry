import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import {
  INVESTIGATE_PATTERN,
  PRESENT_PATTERN,
} from "@/lib/ai/consultation-intent";
import {
  buildRecipeHistoryText,
  selectRecipes,
} from "@/lib/ai/consultation-recipes";
import { getGeminiApiKey, getGeminiModel } from "@/lib/ai/gemini";

/** AI相談の難しい質問向け（品質優先） */
export const DEFAULT_CONSULTATION_HARD_MODEL = "gemini-3.5-flash";

/** 表示系・短い事実確認とみなす文字数上限（前後空白除く） */
export const PRESENT_SHORT_MAX_CHARS = 60;

export type ConsultationModelTier = "lite" | "hard";

export type ConsultationModelRouteReason =
  | "rule_investigate"
  | "rule_tax_recipe"
  | "rule_present_short"
  | "classifier_simple"
  | "classifier_complex"
  | "classifier_failed_prefer_hard";

export type ConsultationModelRouteResult = {
  modelId: string;
  tier: ConsultationModelTier;
  reason: ConsultationModelRouteReason;
};

export type ComplexityLabel = "simple" | "complex";

const CLASSIFIER_SYSTEM = `あなたは相談質問の難易度分類器です。
simple: 短い事実確認・数字やレポートの提示・定型の説明で足りる。
complex: 原因調査・会計判断・複数条件の比較・前提があいまいで多段の推論が必要。
どちらか一方だけを選んでください。`;

export function getConsultationHardModel(): string {
  return (
    process.env.GEMINI_MODEL_HARD?.trim() || DEFAULT_CONSULTATION_HARD_MODEL
  );
}

export function getConsultationLiteModel(): string {
  // GEMINI_MODEL は既存どおり Lite 既定の上書きに使う
  return getGeminiModel();
}

function matchTaxRecipe(question: string, historyText: string): boolean {
  return selectRecipes(question, historyText).some(
    (recipe) => recipe.id === "consumption-tax",
  );
}

export function matchHardRules(
  question: string,
  historyText: string,
): Extract<
  ConsultationModelRouteReason,
  "rule_investigate" | "rule_tax_recipe"
> | null {
  if (INVESTIGATE_PATTERN.test(question)) {
    return "rule_investigate";
  }
  if (matchTaxRecipe(question, historyText)) {
    return "rule_tax_recipe";
  }
  return null;
}

export function matchLiteRules(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed || trimmed.length > PRESENT_SHORT_MAX_CHARS) {
    return false;
  }
  if (INVESTIGATE_PATTERN.test(trimmed)) {
    return false;
  }
  return PRESENT_PATTERN.test(trimmed);
}

async function classifyWithLite(
  question: string,
): Promise<ComplexityLabel> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const google = createGoogleGenerativeAI({ apiKey });
  const { object } = await generateObject({
    model: google(getConsultationLiteModel()),
    schema: z.object({
      complexity: z.enum(["simple", "complex"]),
    }),
    system: CLASSIFIER_SYSTEM,
    prompt: question.trim(),
    temperature: 0,
  });
  return object.complexity;
}

export type ResolveConsultationModelInput = {
  question: string;
  history?: Array<{ content: string }>;
  /** テスト差し替え用。未指定時は Lite で分類 */
  classify?: (question: string) => Promise<ComplexityLabel>;
};

/**
 * AI相談だけのモデル振り分け。
 * 調査系・税レシピ → hard、短い表示系 → lite、それ以外は Lite 分類（曖昧/失敗は hard）。
 */
export async function resolveConsultationModel(
  input: ResolveConsultationModelInput,
): Promise<ConsultationModelRouteResult> {
  const question = input.question.trim();
  const historyText = buildRecipeHistoryText(input.history ?? []);
  const liteModel = getConsultationLiteModel();
  const hardModel = getConsultationHardModel();

  if (!question) {
    return {
      modelId: hardModel,
      tier: "hard",
      reason: "classifier_failed_prefer_hard",
    };
  }

  const hardRule = matchHardRules(question, historyText);
  if (hardRule) {
    return { modelId: hardModel, tier: "hard", reason: hardRule };
  }

  if (matchLiteRules(question)) {
    return {
      modelId: liteModel,
      tier: "lite",
      reason: "rule_present_short",
    };
  }

  const classify = input.classify ?? classifyWithLite;
  try {
    const complexity = await classify(question);
    if (complexity === "simple") {
      return {
        modelId: liteModel,
        tier: "lite",
        reason: "classifier_simple",
      };
    }
    return {
      modelId: hardModel,
      tier: "hard",
      reason: "classifier_complex",
    };
  } catch {
    return {
      modelId: hardModel,
      tier: "hard",
      reason: "classifier_failed_prefer_hard",
    };
  }
}

export function logConsultationModelRoute(
  result: ConsultationModelRouteResult,
  question: string,
): void {
  console.info("[consultation-model-route]", {
    modelId: result.modelId,
    tier: result.tier,
    reason: result.reason,
    questionLength: question.trim().length,
  });
}
