import {
  isWithinJevChoiceLimit,
  MAX_JEV_CHOICES,
} from "./account-item-buckets";
import { getJevApiKey, getJevBaseUrl, getJevModel } from "./jev-config";

export class JevApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "JevApiError";
  }
}

export interface JevChoiceRequest {
  state: string;
  questionId: string;
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevChoiceAnswer {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProbabilities(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const probabilities: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      probabilities[key] = raw;
    }
  }
  return probabilities;
}

export function parseJevChoiceAnswer(
  payload: unknown,
  questionId: string,
): JevChoiceAnswer | null {
  if (!isRecord(payload)) {
    return null;
  }
  const answers = isRecord(payload.answers) ? payload.answers : null;
  const answer = answers && isRecord(answers[questionId]) ? answers[questionId] : null;
  if (!answer || typeof answer.choice !== "string" || answer.choice.length === 0) {
    return null;
  }
  if (typeof answer.confidence !== "number" || !Number.isFinite(answer.confidence)) {
    return null;
  }
  return {
    choice: answer.choice,
    confidence: answer.confidence,
    probabilities: parseProbabilities(answer.probabilities),
  };
}

export async function runJevChoice(
  request: JevChoiceRequest,
): Promise<JevChoiceAnswer> {
  const apiKey = getJevApiKey();
  if (!apiKey) {
    throw new JevApiError("JEV_API_KEY が設定されていません。");
  }

  const criteriaCount = Object.keys(request.criteria).length;
  if (!isWithinJevChoiceLimit(criteriaCount)) {
    throw new JevApiError(
      `JEV Choice の候補数は 1〜${MAX_JEV_CHOICES} 件です。`,
    );
  }

  const response = await fetch(getJevBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getJevModel(),
      state: request.state,
      questions: {
        [request.questionId]: {
          type: "choice",
          instructions: request.instructions,
          criteria: request.criteria,
        },
      },
    }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new JevApiError("JEV API が不正な JSON を返しました。", response.status);
  }

  if (!response.ok) {
    throw new JevApiError(
      `JEV API request failed: ${response.status}`,
      response.status,
    );
  }

  const answer = parseJevChoiceAnswer(payload, request.questionId);
  if (!answer) {
    throw new JevApiError("JEV API の Choice 応答を解釈できませんでした。");
  }

  return answer;
}
