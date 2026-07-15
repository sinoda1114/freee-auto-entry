import { describe, expect, it, vi } from "vitest";
import type { Database, SqlRow } from "./types";
import {
  createSupportThread,
  countSupportThreadsByTargetIds,
  searchSupportThreads,
} from "./support-threads";

function createDatabaseMock(options?: {
  rows?: SqlRow[];
  rowsAffected?: number;
}): Database {
  const execute = vi.fn(async (sql: string) => {
    if (sql.includes("CREATE ") || sql.includes("ALTER ") || sql.includes("USING fts5")) {
      return { rows: [], rowsAffected: 0 };
    }
    if (sql.startsWith("INSERT INTO support_threads_fts") || sql.startsWith("DELETE FROM support_threads_fts")) {
      return { rows: [], rowsAffected: 1 };
    }
    if (sql.startsWith("INSERT INTO support_threads")) {
      return { rows: [], rowsAffected: 1 };
    }
    if (sql.includes("FROM support_threads_fts") && sql.includes("MATCH")) {
      throw new Error("no such module: fts5");
    }
    return {
      rows: options?.rows ?? [],
      rowsAffected: options?.rowsAffected ?? 0,
    };
  });
  return { execute };
}

describe("support-threads", () => {
  it("creates a support thread", async () => {
    const db = createDatabaseMock();
    const thread = await createSupportThread(db, {
      companyId: "1",
      subject: "カード明細が振替になる",
      category: "accounting",
      status: "resolved",
      questionSummary: "なぜ現金振替になったか",
      answerSummary: "消込時の操作",
      background: "カード利用",
      conclusion: "支出で再登録",
      rawEmail: "件名: カード明細について...",
      sourceUrl:
        "https://mail.google.com/mail/u/0/#inbox/18f123456789abcd",
      tags: ["口座振替", "クレカ"],
      freeeTargetKind: "transfer",
      freeeTargetId: 123,
    });

    expect(thread.id).toBeTruthy();
    expect(thread.companyId).toBe("1");
    expect(thread.subject).toBe("カード明細が振替になる");
    expect(thread.tags).toEqual(["口座振替", "クレカ"]);
    expect(thread.sourceUrl).toBe(
      "https://mail.google.com/mail/u/0/#inbox/18f123456789abcd",
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO support_threads"),
      expect.objectContaining({
        companyId: "1",
        freeeTargetKind: "transfer",
        freeeTargetId: 123,
        sourceUrl:
          "https://mail.google.com/mail/u/0/#inbox/18f123456789abcd",
      }),
    );
  });

  it("falls back to LIKE search when FTS fails", async () => {
    const db = createDatabaseMock({
      rows: [
        {
          id: "t1",
          company_id: "1",
          subject: "カード明細",
          category: "accounting",
          status: "open",
          question_summary: "なぜ？",
          answer_summary: "",
          background: "",
          conclusion: "",
          raw_email: "本文",
          source_url: null,
          tags_json: '["クレカ"]',
          freee_target_kind: null,
          freee_target_id: null,
          created_at: "2026-07-15T00:00:00.000Z",
          updated_at: "2026-07-15T00:00:00.000Z",
        },
      ],
    });

    const threads = await searchSupportThreads(db, "1", { query: "クレカ" });
    expect(threads).toHaveLength(1);
    expect(threads[0]?.subject).toBe("カード明細");
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("LIKE :likeQuery"),
      expect.objectContaining({ likeQuery: "%クレカ%" }),
    );
  });

  it("counts threads grouped by target id", async () => {
    const db = createDatabaseMock({
      rows: [
        {
          id: "t1",
          company_id: "1",
          subject: "a",
          category: "accounting",
          status: "open",
          question_summary: "q",
          answer_summary: "",
          background: "",
          conclusion: "",
          raw_email: "r",
          source_url: null,
          tags_json: "[]",
          freee_target_kind: "wallet_txn",
          freee_target_id: 10,
          created_at: "2026-07-15T00:00:00.000Z",
          updated_at: "2026-07-15T00:00:00.000Z",
        },
        {
          id: "t2",
          company_id: "1",
          subject: "b",
          category: "accounting",
          status: "resolved",
          question_summary: "q2",
          answer_summary: "",
          background: "",
          conclusion: "",
          raw_email: "r2",
          source_url: null,
          tags_json: "[]",
          freee_target_kind: "wallet_txn",
          freee_target_id: 10,
          created_at: "2026-07-14T00:00:00.000Z",
          updated_at: "2026-07-14T00:00:00.000Z",
        },
      ],
    });

    const counts = await countSupportThreadsByTargetIds(db, "1", "wallet_txn", [
      10, 20,
    ]);
    expect(counts).toEqual({ 10: 2 });
  });
});
