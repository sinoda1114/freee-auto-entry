import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { FreeeAuth } from "@/lib/freee/accounting";
import type { AccountingConsultationReport } from "@/lib/ai/accounting-consultation";
import { createConsultationTools } from "@/lib/ai/consultation-tools";
import {
  appendRecipesToSystem,
  buildRecipeHistoryText,
  selectRecipes,
} from "@/lib/ai/consultation-recipes";
import { detectResponseMode } from "@/lib/ai/consultation-intent";
import { parseConsultationTarget } from "@/lib/ai/consultation-target";
import { getGeminiApiKey, getGeminiModel, GeminiApiError } from "@/lib/ai/gemini";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

/** エージェントに渡す直近の会話（最新ターンの直前まで） */
export type ConsultationHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

/** ドメイン手順は書かない。話題別ガイドは consultation-recipes が注入する */
const CORE_SYSTEM_PROMPT = `あなたは freee 会計データの読み取り専用アシスタントです。
ユーザーの質問に答えるため、必要なときはツールで freee からデータを取得してください。
直前の会話がある場合は、その文脈を引き継いで答えてください（「それ」「調べて」「GO」「YES」などは直前の話題の続行とみなす）。

動き方:
- ツールで取れるデータは許可を取らずに自分で取る。毎ターン「よろしいですか？」と聞かない。
- 「調べて」と言われたらすぐツールを呼び、取れた範囲で結論まで進める。
- ユーザーに聞くのは、ツールでも会話履歴でも取れない前提だけ。
- 数値・事実はツール結果に根拠がないなら出さない（捏造や根拠のない丸め推計をしない）。
- ツール結果と矛盾する言い訳をしない（取れた科目内訳があるのに「見えない」と言わない）。

ルール:
- freee のデータは変更しない（読み取りのみ）。
- ツール失敗時は「未取得／エラー」と説明し、権限不足と断定しない。
- ユーザー向けの文に、ツール名・API名・英語の変数名・フィールド名・コード断片を出さない。日本語の普通の言葉に置き換える。
- 表示依頼では数字の提示を優先し、余計な仮説や修正案を並べない。
- 調査依頼では理由と確認ポイントを日本語で説明する。
- 税務・法務の話は概算・要確認とし、最終断定はしない。
- 最終回答は日本語の本文のみ（JSON にしない）。`;

/** トークン抑制のため直近ターン数（user/assistant 各1で1往復） */
const MAX_HISTORY_MESSAGES = 8;

export interface RunConsultationAgentInput {
  auth: FreeeAuth;
  question: string;
  targetHint?: string;
  pagePath?: string;
  /** 今回の質問より前の会話（新しい順ではなく時系列順） */
  history?: ConsultationHistoryTurn[];
}

export function buildConsultationSystemPrompt(
  question: string,
  history: ConsultationHistoryTurn[] = [],
): string {
  const historyText = buildRecipeHistoryText(history);
  const recipes = selectRecipes(question, historyText);
  return appendRecipesToSystem(CORE_SYSTEM_PROMPT, recipes);
}

function buildCurrentUserContent(input: RunConsultationAgentInput): string {
  const target =
    parseConsultationTarget(input.targetHint ?? "") ??
    parseConsultationTarget(input.question);
  const lines = [
    `質問: ${input.question}`,
    input.targetHint?.trim()
      ? `対象ヒント: ${input.targetHint.trim()}`
      : null,
    target
      ? `パース済み対象: ${target.kind} #${target.id}`
      : "パース済み対象: なし",
    input.pagePath ? `アプリ画面: ${input.pagePath}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function toModelMessages(
  history: ConsultationHistoryTurn[],
  currentUserContent: string,
): ModelMessage[] {
  const trimmed = history
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map(
      (turn): ModelMessage => ({
        role: turn.role,
        content: turn.content.trim(),
      }),
    );
  return [...trimmed, { role: "user", content: currentUserContent }];
}

function normalizeReport(
  text: string,
  question: string,
): AccountingConsultationReport {
  const hasTarget = Boolean(parseConsultationTarget(question));
  const mode = detectResponseMode(
    question,
    hasTarget ? "record" : /損益|貸借|試算|元帳|表示|見せ/.test(question)
      ? "report_pl"
      : "general",
  );
  return {
    mode,
    summary: text.trim(),
    facts: [],
    hypotheses: [],
    checkpoints: [],
    suggestions: [],
  };
}

export function parseConsultationHistoryJson(
  raw: string,
): ConsultationHistoryTurn[] {
  if (!raw.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const turns: ConsultationHistoryTurn[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as { role?: unknown; content?: unknown };
      if (
        (row.role === "user" || row.role === "assistant") &&
        typeof row.content === "string" &&
        row.content.trim()
      ) {
        turns.push({ role: row.role, content: row.content.trim() });
      }
    }
    return turns.slice(-MAX_HISTORY_MESSAGES);
  } catch {
    return [];
  }
}

export async function runConsultationAgent(
  input: RunConsultationAgentInput,
): Promise<AccountingConsultationReport> {
  if (isE2ETestMode()) {
    return {
      mode: "investigate",
      summary:
        "E2E: カード明細由来の処理が、支出ではなく口座振替（現金）として登録されている可能性が高いです。",
      facts: [
        "振替元がクレジットカード口座です。",
        "振替先が現金口座です。",
      ],
      hypotheses: [],
      checkpoints: ["現金口座の入金履歴を確認してください。"],
      suggestions: [],
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiApiError("GEMINI_API_KEY が設定されていません。");
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId = getGeminiModel();
  const tools = createConsultationTools(input.auth);
  const history = input.history ?? [];
  const system = buildConsultationSystemPrompt(input.question, history);
  const messages = toModelMessages(history, buildCurrentUserContent(input));

  try {
    const result = await generateText({
      model: google(modelId),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(10),
      temperature: 0.2,
    });

    const text = result.text?.trim();
    if (!text) {
      throw new GeminiApiError("Gemini API returned an empty response.");
    }
    return normalizeReport(text, input.question);
  } catch (error) {
    if (error instanceof GeminiApiError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "AI相談を取得できませんでした。";
    throw new GeminiApiError(message);
  }
}
