"use server";

import { consultAccountingWithLlm } from "@/lib/ai/accounting-consultation";
import {
  formatConsultationTargetLabel,
  parseConsultationTarget,
} from "@/lib/ai/consultation-target";
import { GeminiApiError } from "@/lib/ai/gemini";
import { findSimilarSupportThreads } from "@/lib/ai/support-similarity";
import { recordSupportInvestigation } from "@/lib/db/support-investigations";
import { listRecentSupportThreads } from "@/lib/db/support-threads";
import { getDatabase } from "@/lib/db/turso";
import { gatherConsultationContext } from "@/lib/freee/consultation-data";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { isE2ETestMode } from "@/lib/e2e/fixtures";

export type AiConsultationReportPayload = {
  summary: string;
  facts: string[];
  hypotheses: Array<{
    title: string;
    likelihood: "high" | "medium" | "low";
    reasoning: string;
  }>;
  checkpoints: string[];
  suggestions: string[];
};

export type AiConsultationState =
  | { status: "idle" }
  | {
      status: "success";
      investigationId: string | null;
      targetLabel: string | null;
      report: AiConsultationReportPayload;
      similar: Array<{ threadId: string; reason: string; subject: string }>;
    }
  | { status: "error"; message: string };

export async function aiConsultationAction(
  _prevState: AiConsultationState,
  formData: FormData,
): Promise<AiConsultationState> {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return {
      status: "error",
      message: "freee連携が切れています。再ログインしてください。",
    };
  }

  const companyId = String(formData.get("companyId") ?? "").trim();
  if (companyId !== auth.companyId) {
    return { status: "error", message: "事業所が一致しません。" };
  }

  const question = String(formData.get("question") ?? "").trim();
  const targetHint = String(formData.get("targetHint") ?? "").trim();
  const pagePath = String(formData.get("pagePath") ?? "").trim();

  if (!question) {
    return { status: "error", message: "相談内容を入力してください。" };
  }

  const target =
    parseConsultationTarget(targetHint) ?? parseConsultationTarget(question);

  try {
    const candidates = await listRecentSupportThreads(
      getDatabase(),
      auth.companyId,
      30,
    ).catch(() => []);
    const similarMatches = isE2ETestMode()
      ? []
      : await findSimilarSupportThreads({ query: question, candidates }).catch(
          () => [],
        );
    const threadById = new Map(candidates.map((thread) => [thread.id, thread]));
    const similar = similarMatches
      .map((match) => {
        const thread = threadById.get(match.threadId);
        if (!thread) {
          return null;
        }
        return {
          threadId: match.threadId,
          reason: match.reason,
          subject: thread.subject,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (isE2ETestMode()) {
      const report = {
        summary:
          "カード明細由来の処理が、支出ではなく口座振替（現金）として登録されている可能性が高いです。",
        facts: [
          "振替元がクレジットカード口座です。",
          "振替先が現金口座です。",
          "関連明細に店舗名らしい摘要が見えます。",
        ],
        hypotheses: [
          {
            title: "明細消込時に口座振替を選び、振替先を現金にした",
            likelihood: "high" as const,
            reasoning:
              "カード自動取込明細を支出ではなく振替で処理したときに起きやすいパターンです。",
          },
        ],
        checkpoints: [
          "現金口座に同額の入金履歴があるか確認してください。",
          "同日・同額の支出取引が別にないか確認してください。",
        ],
        suggestions: [
          "本来が店舗利用のカード支払いなら、振替を見直して支出登録を検討してください。",
        ],
      };
      const investigation = await recordSupportInvestigation(getDatabase(), {
        companyId: auth.companyId,
        question,
        report,
        targetKind: target?.kind ?? null,
        targetId: target?.id ?? null,
        pagePath: pagePath || null,
      }).catch(() => null);
      return {
        status: "success",
        investigationId: investigation?.id ?? null,
        targetLabel: formatConsultationTargetLabel(target),
        report,
        similar,
      };
    }

    const context = await gatherConsultationContext(auth, target, question);
    const report = await consultAccountingWithLlm({
      question,
      target,
      context,
      pagePath: pagePath || undefined,
    });
    const investigation = await recordSupportInvestigation(getDatabase(), {
      companyId: auth.companyId,
      question,
      report,
      targetKind: target?.kind ?? null,
      targetId: target?.id ?? null,
      pagePath: pagePath || null,
    }).catch(() => null);

    return {
      status: "success",
      investigationId: investigation?.id ?? null,
      targetLabel: formatConsultationTargetLabel(target) ?? context.targetLabel,
      report,
      similar,
    };
  } catch (error) {
    if (error instanceof GeminiApiError) {
      return {
        status: "error",
        message:
          error.message === "GEMINI_API_KEY が設定されていません。"
            ? "AI相談は未設定です。GEMINI_API_KEY を環境変数に追加してください。"
            : error.message,
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "AI相談を取得できませんでした。",
    };
  }
}
