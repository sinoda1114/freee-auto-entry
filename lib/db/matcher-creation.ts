import { randomUUID } from "node:crypto";
import { ensureDatabaseSchema } from "./schema";
import type { Database } from "./types";

const CLAIM_LEASE_MS = 15 * 60 * 1_000;

export interface MatcherCreationClaim {
  companyId: string;
  ruleKey: string;
  claimToken: string;
}

export async function claimMatcherCreation(
  db: Database,
  companyId: string,
  ruleKey: string,
): Promise<MatcherCreationClaim | null> {
  await ensureDatabaseSchema(db);
  const claimToken = randomUUID();
  const reservedAt = new Date().toISOString();
  try {
    await db.execute(
      `INSERT INTO matcher_creation_locks (
        company_id, rule_key, claim_token, reserved_at
      ) VALUES (:companyId, :ruleKey, :claimToken, :reservedAt)`,
      { companyId, ruleKey, claimToken, reservedAt },
    );
    return { companyId, ruleKey, claimToken };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.toLowerCase().includes("unique")
    ) {
      throw error;
    }
  }

  const existing = await db.execute(
    `SELECT claim_token, reserved_at, external_started_at, matcher_id
      FROM matcher_creation_locks
      WHERE company_id = :companyId AND rule_key = :ruleKey
      LIMIT 1`,
    { companyId, ruleKey },
  );
  const row = existing.rows[0];
  const existingReservedAt =
    typeof row?.reserved_at === "string"
      ? Date.parse(row.reserved_at)
      : Number.NaN;
  const canReclaim =
    row?.external_started_at === null &&
    row?.matcher_id === null &&
    Number.isFinite(existingReservedAt) &&
    Date.now() - existingReservedAt >= CLAIM_LEASE_MS;
  if (!canReclaim || typeof row?.claim_token !== "string") {
    return null;
  }
  const deleted = await db.execute(
    `DELETE FROM matcher_creation_locks
      WHERE company_id = :companyId
        AND rule_key = :ruleKey
        AND claim_token = :claimToken
        AND external_started_at IS NULL
        AND matcher_id IS NULL`,
    { companyId, ruleKey, claimToken: row.claim_token },
  );
  return deleted.rowsAffected === 1
    ? claimMatcherCreation(db, companyId, ruleKey)
    : null;
}

export async function markMatcherCreationStarted(
  db: Database,
  claim: MatcherCreationClaim,
): Promise<void> {
  const result = await db.execute(
    `UPDATE matcher_creation_locks
      SET external_started_at = :startedAt
      WHERE company_id = :companyId
        AND rule_key = :ruleKey
        AND claim_token = :claimToken
        AND external_started_at IS NULL`,
    { ...claim, startedAt: new Date().toISOString() },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("自動登録ルールの作成ロックを更新できませんでした。");
  }
}

export async function completeMatcherCreation(
  db: Database,
  claim: MatcherCreationClaim,
  matcherId: number,
): Promise<void> {
  const result = await db.execute(
    `UPDATE matcher_creation_locks
      SET matcher_id = :matcherId
      WHERE company_id = :companyId
        AND rule_key = :ruleKey
        AND claim_token = :claimToken`,
    { ...claim, matcherId },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("自動登録ルールの作成結果を保存できませんでした。");
  }
}

export async function releaseMatcherCreation(
  db: Database,
  claim: MatcherCreationClaim,
): Promise<void> {
  const result = await db.execute(
    `DELETE FROM matcher_creation_locks
      WHERE company_id = :companyId
        AND rule_key = :ruleKey
        AND claim_token = :claimToken`,
    {
      companyId: claim.companyId,
      ruleKey: claim.ruleKey,
      claimToken: claim.claimToken,
    },
  );
  if (result.rowsAffected !== 1) {
    throw new Error("自動登録ルールの作成ロックを解放できませんでした。");
  }
}
