"use server";

import { consultAccountingWithLlm } from "@/lib/ai/accounting-consultation";
import {
  formatConsultationTargetLabel,
  parseConsultationTarget,
  type ConsultationTargetKind,
} from "@/lib/ai/consultation-target";
import { parseSupportEmailWithLlm } from "@/lib/ai/support-email-parse";
import { findSimilarSupportThreads } from "@/lib/ai/support-similarity";
import { GeminiApiError } from "@/lib/ai/gemini";
import {
  createSupportThread,
  listRecentSupportThreads,
  type SupportThreadCategory,
  type SupportThreadStatus,
} from "@/lib/db/support-threads";
import {
  getSupportInvestigation,
  linkInvestigationToThread,
  recordSupportInvestigation,
} from "@/lib/db/support-investigations";
import { getDatabase } from "@/lib/db/turso";
import { gatherConsultationContext } from "@/lib/freee/consultation-data";
import { getValidFreeeAuth } from "@/lib/freee/session-client";
import { isE2ETestMode } from "@/lib/e2e/fixtures";
import { isSupportThreadCategory } from "@/lib/support/categories";
import { normalizeGmailSourceUrl } from "@/lib/support/gmail-source-url";
import { revalidatePath } from "next/cache";

function isStatus(value: string): value is SupportThreadStatus {
  return value === "open" || value === "resolved" || value === "follow_up";
}

function isTargetKind(value: string): value is ConsultationTargetKind {
  return value === "transfer" || value === "deal" || value === "wallet_txn";
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,、\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

async function requireAuth(formData: FormData) {
  const auth = await getValidFreeeAuth();
  if (!auth) {
    return {
      auth: null as null,
      error: "freee連携が切れています。再ログインしてください。",
    };
  }
  const companyId = String(formData.get("companyId") ?? "").trim();
  if (companyId !== auth.companyId) {
    return {
      auth: null as null,
      error: "事業所が一致しません。",
    };
  }
  return { auth, error: null as null };
}

export type ImportSupportEmailState =
  | { status: "idle" }
  | {
      status: "preview";
      draft: {
        subject: string;
        category: SupportThreadCategory;
        status: SupportThreadStatus;
        questionSummary: string;
        answerSummary: string;
        background: string;
        conclusion: string;
        tags: string[];
        freeeTargetKind: ConsultationTargetKind | null;
        freeeTargetId: number | null;
        rawEmail: string;
        sourceUrl: string | null;
        isMemo: boolean;
      };
      similar: Array<{ threadId: string; reason: string; subject: string }>;
    }
  | { status: "error"; message: string };

export async function importSupportEmailAction(
  _prev: ImportSupportEmailState,
  formData: FormData,
): Promise<ImportSupportEmailState> {
  const { auth, error } = await requireAuth(formData);
  if (!auth) {
    return { status: "error", message: error };
  }

  const rawEmail = String(formData.get("rawEmail") ?? "").trim();
  const isMemo = String(formData.get("isMemo") ?? "") === "true";
  const sourceUrlInput = String(formData.get("sourceUrl") ?? "");
  const sourceUrl = isMemo ? null : normalizeGmailSourceUrl(sourceUrlInput);
  if (!rawEmail) {
    return { status: "error", message: "メール本文を貼り付けてください。" };
  }
  if (!isMemo && !sourceUrl) {
    return {
      status: "error",
      message:
        "Gmailで元メールを開き、ブラウザのURLを貼り付けてください。メモの場合は「メールではなくメモとして保存」を選べます。",
    };
  }

  try {
    const parsed = isE2ETestMode()
      ? {
          subject: "E2Eテスト問い合わせ",
          category: "accounting" as const,
          status: "open" as const,
          questionSummary: "テスト質問",
          answerSummary: "",
          background: "",
          conclusion: "",
          tags: ["テスト"],
          freeeTarget: parseConsultationTarget(rawEmail),
        }
      : await parseSupportEmailWithLlm(rawEmail);

    const candidates = await listRecentSupportThreads(
      getDatabase(),
      auth.companyId,
      30,
    );
    const similarMatches = isE2ETestMode()
      ? []
      : await findSimilarSupportThreads({
          query: `${parsed.subject}\n${parsed.questionSummary}\n${rawEmail.slice(0, 1500)}`,
          candidates,
        });
    const threadById = new Map(candidates.map((thread) => [thread.id, thread]));

    return {
      status: "preview",
      draft: {
        subject: parsed.subject,
        category: parsed.category,
        status: parsed.status,
        questionSummary: parsed.questionSummary,
        answerSummary: parsed.answerSummary,
        background: parsed.background,
        conclusion: parsed.conclusion,
        tags: parsed.tags,
        freeeTargetKind: parsed.freeeTarget?.kind ?? null,
        freeeTargetId: parsed.freeeTarget?.id ?? null,
        rawEmail,
        sourceUrl,
        isMemo,
      },
      similar: similarMatches
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
        .filter((item): item is NonNullable<typeof item> => item !== null),
    };
  } catch (err) {
    if (err instanceof GeminiApiError) {
      return {
        status: "error",
        message:
          err.message === "GEMINI_API_KEY が設定されていません。"
            ? "AI整形は未設定です。GEMINI_API_KEY を環境変数に追加してください。"
            : err.message,
      };
    }
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "メールを解析できませんでした。",
    };
  }
}

export type SaveSupportThreadState =
  | { status: "idle" }
  | { status: "success"; threadId: string }
  | { status: "error"; message: string };

export async function saveSupportThreadAction(
  _prev: SaveSupportThreadState,
  formData: FormData,
): Promise<SaveSupportThreadState> {
  const { auth, error } = await requireAuth(formData);
  if (!auth) {
    return { status: "error", message: error };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "other");
  const statusRaw = String(formData.get("status") ?? "open");
  const questionSummary = String(formData.get("questionSummary") ?? "").trim();
  const answerSummary = String(formData.get("answerSummary") ?? "").trim();
  const background = String(formData.get("background") ?? "").trim();
  const conclusion = String(formData.get("conclusion") ?? "").trim();
  const rawEmail = String(formData.get("rawEmail") ?? "");
  const isMemo = String(formData.get("isMemo") ?? "") === "true";
  const sourceUrlInput = String(formData.get("sourceUrl") ?? "");
  const sourceUrl = isMemo ? null : normalizeGmailSourceUrl(sourceUrlInput);
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const targetKindRaw = String(formData.get("freeeTargetKind") ?? "").trim();
  const targetIdRaw = String(formData.get("freeeTargetId") ?? "").trim();
  const investigationId = String(formData.get("investigationId") ?? "").trim();

  if (!subject || !questionSummary || !rawEmail.trim()) {
    return {
      status: "error",
      message: "件名・質問要約・元メール本文は必須です。",
    };
  }
  if (!isMemo && !sourceUrl) {
    return {
      status: "error",
      message:
        "Gmailの元メールURLが必要です。メールではない記録はメモとして保存してください。",
    };
  }
  if (!isSupportThreadCategory(categoryRaw) || !isStatus(statusRaw)) {
    return { status: "error", message: "カテゴリまたは状態が不正です。" };
  }

  let freeeTargetKind: ConsultationTargetKind | null = null;
  let freeeTargetId: number | null = null;
  if (targetKindRaw && isTargetKind(targetKindRaw) && targetIdRaw) {
    const id = Number(targetIdRaw);
    if (Number.isInteger(id) && id > 0) {
      freeeTargetKind = targetKindRaw;
      freeeTargetId = id;
    }
  } else {
    const parsedTarget =
      parseConsultationTarget(rawEmail) ??
      parseConsultationTarget(`${subject}\n${questionSummary}`);
    freeeTargetKind = parsedTarget?.kind ?? null;
    freeeTargetId = parsedTarget?.id ?? null;
  }

  try {
    const thread = await createSupportThread(getDatabase(), {
      companyId: auth.companyId,
      subject,
      category: categoryRaw,
      status: statusRaw,
      questionSummary,
      answerSummary,
      background,
      conclusion,
      rawEmail,
      sourceUrl,
      tags,
      freeeTargetKind,
      freeeTargetId,
    });

    if (investigationId) {
      const investigation = await getSupportInvestigation(
        getDatabase(),
        auth.companyId,
        investigationId,
      );
      if (investigation) {
        await linkInvestigationToThread(
          getDatabase(),
          auth.companyId,
          investigationId,
          thread.id,
        );
      }
    }

    revalidatePath("/support");
    revalidatePath("/wallet-txns");
    return { status: "success", threadId: thread.id };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "問い合わせを保存できませんでした。",
    };
  }
}

export type InvestigateSupportState =
  | { status: "idle" }
  | {
      status: "success";
      investigationId: string;
      targetLabel: string | null;
      report: {
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
      similar: Array<{ threadId: string; reason: string; subject: string }>;
    }
  | { status: "error"; message: string };

export async function investigateSupportAction(
  _prev: InvestigateSupportState,
  formData: FormData,
): Promise<InvestigateSupportState> {
  const { auth, error } = await requireAuth(formData);
  if (!auth) {
    return { status: "error", message: error };
  }

  const question = String(formData.get("question") ?? "").trim();
  const targetHint = String(formData.get("targetHint") ?? "").trim();
  const pagePath = String(formData.get("pagePath") ?? "").trim();

  if (!question) {
    return { status: "error", message: "調査したい内容を入力してください。" };
  }

  const target =
    parseConsultationTarget(targetHint) ?? parseConsultationTarget(question);

  try {
    const candidates = await listRecentSupportThreads(
      getDatabase(),
      auth.companyId,
      30,
    );
    const similarMatches = isE2ETestMode()
      ? []
      : await findSimilarSupportThreads({ query: question, candidates });
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
        mode: "investigate" as const,
        summary: "E2E調査結果です。",
        facts: ["事実1"],
        hypotheses: [
          {
            title: "仮説",
            likelihood: "medium" as const,
            reasoning: "理由",
          },
        ],
        checkpoints: ["確認1"],
        suggestions: ["提案1"],
      };
      const investigation = await recordSupportInvestigation(getDatabase(), {
        companyId: auth.companyId,
        question,
        report,
        targetKind: target?.kind ?? null,
        targetId: target?.id ?? null,
        pagePath: pagePath || null,
      });
      return {
        status: "success",
        investigationId: investigation.id,
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
    });

    return {
      status: "success",
      investigationId: investigation.id,
      targetLabel:
        formatConsultationTargetLabel(target) ?? context.targetLabel,
      report,
      similar,
    };
  } catch (err) {
    if (err instanceof GeminiApiError) {
      return {
        status: "error",
        message:
          err.message === "GEMINI_API_KEY が設定されていません。"
            ? "AI調査は未設定です。GEMINI_API_KEY を環境変数に追加してください。"
            : err.message,
      };
    }
    return {
      status: "error",
      message: err instanceof Error ? err.message : "調査できませんでした。",
    };
  }
}