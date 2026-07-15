import { generateGeminiJson } from "./gemini";
import type { SupportThread } from "@/lib/db/support-threads";

export interface SimilarSupportThreadMatch {
  threadId: string;
  reason: string;
}

interface RawSimilarityResponse {
  matches?: unknown;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          threadId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["threadId", "reason"],
      },
      description: "Up to 5 similar past threads, most relevant first",
    },
  },
  required: ["matches"],
} as const;

function parseMatches(
  raw: RawSimilarityResponse,
  candidateIds: Set<string>,
): SimilarSupportThreadMatch[] {
  if (!Array.isArray(raw.matches)) {
    return [];
  }
  const results: SimilarSupportThreadMatch[] = [];
  for (const item of raw.matches) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const threadId =
      "threadId" in item && typeof item.threadId === "string"
        ? item.threadId.trim()
        : "";
    const reason =
      "reason" in item && typeof item.reason === "string"
        ? item.reason.trim()
        : "";
    if (!threadId || !reason || !candidateIds.has(threadId)) {
      continue;
    }
    results.push({ threadId, reason });
  }
  return results.slice(0, 5);
}

export function buildSupportSimilarityPrompt(input: {
  query: string;
  candidates: SupportThread[];
}): string {
  const lines = input.candidates.map((thread) =>
    [
      `- id=${thread.id}`,
      `subject=${thread.subject}`,
      `category=${thread.category}`,
      `status=${thread.status}`,
      `question=${thread.questionSummary}`,
      `answer=${thread.answerSummary}`,
      `tags=${thread.tags.join(",")}`,
    ].join(" | "),
  );

  return [
    "You find similar past freee support inquiries for a user.",
    "Return JSON only. Reasons must be Japanese and briefly explain why it matches.",
    "Only return thread IDs from the candidate list.",
    "If nothing is similar, return an empty matches array.",
    "",
    `Current question or email excerpt: ${input.query}`,
    "",
    "Candidates:",
    lines.length > 0 ? lines.join("\n") : "- none",
  ].join("\n");
}

export async function findSimilarSupportThreads(input: {
  query: string;
  candidates: SupportThread[];
}): Promise<SimilarSupportThreadMatch[]> {
  const query = input.query.trim();
  if (!query || input.candidates.length === 0) {
    return [];
  }

  const candidateIds = new Set(input.candidates.map((thread) => thread.id));
  try {
    const raw = await generateGeminiJson<RawSimilarityResponse>(
      buildSupportSimilarityPrompt(input),
      RESPONSE_SCHEMA,
    );
    return parseMatches(raw, candidateIds);
  } catch {
    return [];
  }
}
