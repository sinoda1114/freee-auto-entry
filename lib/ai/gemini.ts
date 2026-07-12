import { isE2ETestMode } from "@/lib/e2e/fixtures";

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

async function callGeminiApi<T>(
  parts: Array<Record<string, unknown>>,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiApiError("GEMINI_API_KEY が設定されていません。");
  }

  const model = getGeminiModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  const data = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new GeminiApiError(
      data.error?.message ?? `Gemini API request failed: ${response.status}`,
      response.status,
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiApiError("Gemini API returned an empty response.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiApiError("Gemini API returned invalid JSON.");
  }
}

export async function generateGeminiJson<T>(
  prompt: string,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  if (isE2ETestMode()) {
    void prompt;
    void responseSchema;
    return {
      rules: [
        {
          description: "DAZN",
          condition: 0,
          accountItemName: "通信費",
          taxName: "課対仕入10%",
          entrySide: "expense",
          reasoning: "サブスクリプション料金として通信費が妥当です。",
          transactionIds: [102],
        },
      ],
      candidates: [
        {
          accountItemName: "通信費",
          taxName: "課対仕入10%",
          condition: 0,
          reasoning: "サブスクリプション料金として通信費が妥当です。",
        },
      ],
    } as T;
  }

  return callGeminiApi<T>([{ text: prompt }], responseSchema);
}

/**
 * 画像（base64）とテキストプロンプトを組み合わせてGeminiに問い合わせ、JSON応答を返す。
 * マルチモーダル（vision）用。
 */
export async function generateGeminiJsonWithImage<T>(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  return callGeminiApi<T>(
    [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
      { text: prompt },
    ],
    responseSchema,
  );
}
