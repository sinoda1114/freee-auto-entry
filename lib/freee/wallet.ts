import type { FreeeAuth } from "./accounting";
import {
  e2eUserMatchers,
  e2eWalletTransactions,
  isE2ETestMode,
  mutateE2EUserMatcher,
} from "@/lib/e2e/fixtures";

const ACCOUNTING_API_BASE = "https://api.freee.co.jp/api/1";

export type EntrySide = "income" | "expense";
export type WalletableType = "bank_account" | "credit_card" | "wallet";
export type MatcherCondition = 0 | 1 | 2 | 3 | 4;
export type CreateMatcherCondition = Exclude<MatcherCondition, 4>;

export class FreeeAccountingApiError extends Error {
  constructor(public readonly status: number) {
    super(`freee accounting API request failed: ${status}`);
    this.name = "FreeeAccountingApiError";
  }
}

export interface WalletTransaction {
  id: number;
  companyId: string;
  date: string;
  amount: number;
  dueAmount: number;
  entrySide: EntrySide;
  walletableType: WalletableType;
  walletableId: number;
  description: string;
  status: number;
  ruleMatched: boolean;
}

export interface UserMatcher {
  id: number;
  entrySide: EntrySide;
  description: string;
  condition: MatcherCondition;
  priority: number;
  act: number;
  accountItemName?: string;
  taxName?: string;
  walletable?: string;
  minAmount?: number;
  maxAmount?: number;
  active: boolean;
}

export interface CreateUserMatcherInput {
  entrySide: EntrySide;
  description: string;
  condition: CreateMatcherCondition;
  priority: number;
  accountItemName: string;
  taxName: string;
  walletable?: string;
}

export interface UpdateUserMatcherInput {
  active?: boolean;
  accountItemName?: string;
  taxName?: string;
  description?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntrySide(value: unknown): value is EntrySide {
  return value === "income" || value === "expense";
}

function isWalletableType(value: unknown): value is WalletableType {
  return (
    value === "bank_account" ||
    value === "credit_card" ||
    value === "wallet"
  );
}

function isMatcherCondition(value: unknown): value is MatcherCondition {
  return (
    value === 0 || value === 1 || value === 2 || value === 3 || value === 4
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseWalletTransaction(value: unknown): WalletTransaction {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    (typeof value.company_id !== "number" &&
      typeof value.company_id !== "string") ||
    typeof value.date !== "string" ||
    typeof value.amount !== "number" ||
    typeof value.due_amount !== "number" ||
    !isEntrySide(value.entry_side) ||
    !isWalletableType(value.walletable_type) ||
    typeof value.walletable_id !== "number" ||
    typeof value.description !== "string" ||
    typeof value.status !== "number" ||
    typeof value.rule_matched !== "boolean"
  ) {
    throw new Error("freee wallet transaction response is invalid");
  }

  return {
    id: value.id,
    companyId: String(value.company_id),
    date: value.date,
    amount: value.amount,
    dueAmount: value.due_amount,
    entrySide: value.entry_side,
    walletableType: value.walletable_type,
    walletableId: value.walletable_id,
    description: value.description,
    status: value.status,
    ruleMatched: value.rule_matched,
  };
}

function parseUserMatcher(value: unknown): UserMatcher {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !isEntrySide(value.entry_side_str) ||
    typeof value.description !== "string" ||
    !isMatcherCondition(value.condition) ||
    typeof value.priority !== "number" ||
    typeof value.act !== "number" ||
    typeof value.active !== "boolean"
  ) {
    throw new Error("freee user matcher response is invalid");
  }

  return {
    id: value.id,
    entrySide: value.entry_side_str,
    description: value.description,
    condition: value.condition,
    priority: value.priority,
    act: value.act,
    accountItemName: optionalString(value.account_item_name),
    taxName: optionalString(value.tax_name),
    walletable: optionalString(value.walletable),
    minAmount: optionalNumber(value.min_amount),
    maxAmount: optionalNumber(value.max_amount),
    active: value.active,
  };
}

async function freeeFetch(
  auth: FreeeAuth,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${ACCOUNTING_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new FreeeAccountingApiError(response.status);
  }
  return response.json();
}

export async function getWalletTransactions(
  auth: FreeeAuth,
  pagination: { offset: number; limit: number },
): Promise<WalletTransaction[]> {
  if (isE2ETestMode()) {
    return e2eWalletTransactions.slice(
      pagination.offset,
      pagination.offset + pagination.limit,
    );
  }
  const params = new URLSearchParams({
    company_id: auth.companyId,
    offset: String(pagination.offset),
    limit: String(pagination.limit),
  });
  const data = await freeeFetch(auth, `/wallet_txns?${params}`);
  if (
    !isRecord(data) ||
    !Array.isArray(data.wallet_txns)
  ) {
    throw new Error("freee wallet transactions response is invalid");
  }
  return data.wallet_txns.map(parseWalletTransaction);
}

export async function getUserMatchers(
  auth: FreeeAuth,
  pagination: {
    offset: number;
    limit: number;
    act?: number;
    active?: "active" | "inactive" | "all";
  },
): Promise<UserMatcher[]> {
  if (isE2ETestMode()) {
    const filtered = e2eUserMatchers.filter((matcher) => {
      if (pagination.act !== undefined && matcher.act !== pagination.act) {
        return false;
      }
      if (pagination.active === "inactive") {
        return !matcher.active;
      }
      if (pagination.active === "active" || pagination.active === undefined) {
        return matcher.active;
      }
      return true;
    });
    return filtered.slice(
      pagination.offset,
      pagination.offset + pagination.limit,
    );
  }
  const params = new URLSearchParams({
    company_id: auth.companyId,
    offset: String(pagination.offset),
    limit: String(pagination.limit),
    active: pagination.active ?? "active",
  });
  if (pagination.act !== undefined) {
    params.set("act", String(pagination.act));
  }
  const data = await freeeFetch(auth, `/user_matchers?${params}`);
  if (!isRecord(data) || !Array.isArray(data.data)) {
    throw new Error("freee user matchers response is invalid");
  }
  return data.data.map(parseUserMatcher);
}

export async function createUserMatcher(
  auth: FreeeAuth,
  input: CreateUserMatcherInput,
): Promise<{ id: number }> {
  if (isE2ETestMode()) {
    return { id: 9000 + Math.floor(Math.random() * 1000) };
  }
  const params = new URLSearchParams({ company_id: auth.companyId });
  const data = await freeeFetch(auth, `/user_matchers?${params}`, {
    method: "POST",
    body: JSON.stringify({
      act: 1,
      active: true,
      condition: input.condition,
      description: input.description,
      entry_side_str: input.entrySide,
      priority: input.priority,
      tax_name: input.taxName,
      account_item_name: input.accountItemName,
      qualified_invoice_setting: "non_qualified",
      suggest_tax_from_walletable_invoice: false,
      ...(input.walletable ? { walletable: input.walletable } : {}),
    }),
  });
  if (!isRecord(data) || typeof data.id !== "number") {
    throw new Error("freee user matcher response is invalid");
  }
  return { id: data.id };
}

export async function getUserMatcherById(
  auth: FreeeAuth,
  id: number,
): Promise<UserMatcher> {
  if (isE2ETestMode()) {
    const found = e2eUserMatchers.find((m) => m.id === id);
    if (!found) {
      throw new Error(`E2E matcher not found: ${id}`);
    }
    return { ...found };
  }
  const params = new URLSearchParams({ company_id: auth.companyId });
  const data = await freeeFetch(auth, `/user_matchers/${id}?${params}`);
  return parseUserMatcher(data);
}

export async function updateUserMatcher(
  auth: FreeeAuth,
  matcher: UserMatcher,
  updates: UpdateUserMatcherInput,
): Promise<UserMatcher> {
  const merged: UserMatcher = {
    ...matcher,
    active: updates.active ?? matcher.active,
    description: updates.description ?? matcher.description,
    accountItemName: updates.accountItemName ?? matcher.accountItemName,
    taxName: updates.taxName ?? matcher.taxName,
  };

  if (isE2ETestMode()) {
    mutateE2EUserMatcher(merged);
    return merged;
  }

  const params = new URLSearchParams({ company_id: auth.companyId });
  const body: Record<string, unknown> = {
    act: matcher.act,
    active: merged.active,
    condition: matcher.condition,
    description: merged.description,
    entry_side_str: matcher.entrySide,
    priority: matcher.priority,
    qualified_invoice_setting: "non_qualified",
    suggest_tax_from_walletable_invoice: false,
  };
  if (merged.accountItemName !== undefined) {
    body.account_item_name = merged.accountItemName;
  }
  if (merged.taxName !== undefined) {
    body.tax_name = merged.taxName;
  }
  if (matcher.walletable !== undefined) {
    body.walletable = matcher.walletable;
  }

  const data = await freeeFetch(auth, `/user_matchers/${matcher.id}?${params}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return parseUserMatcher(data);
}

const SUGGESTION_MATCHER_ACTS = [0, 1] as const;

export async function getAllUserMatchersForActs(
  auth: FreeeAuth,
  acts: readonly number[] = SUGGESTION_MATCHER_ACTS,
  pageSize = 100,
): Promise<UserMatcher[]> {
  const matchers: UserMatcher[] = [];
  for (const act of acts) {
    for (let offset = 0; ; offset += pageSize) {
      const page = await getUserMatchers(auth, { offset, limit: pageSize, act });
      matchers.push(...page);
      if (page.length < pageSize) {
        break;
      }
    }
  }

  const seen = new Set<number>();
  return matchers.filter((matcher) => {
    if (seen.has(matcher.id)) {
      return false;
    }
    seen.add(matcher.id);
    return true;
  });
}

export async function getAllUserMatchers(
  auth: FreeeAuth,
  options: { active?: "active" | "inactive" | "all" } = {},
  pageSize = 100,
): Promise<UserMatcher[]> {
  const matchers: UserMatcher[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await getUserMatchers(auth, {
      offset,
      limit: pageSize,
      active: options.active ?? "active",
    });
    matchers.push(...page);
    if (page.length < pageSize) {
      return matchers;
    }
  }
}

export function descriptionMatches(
  value: string,
  expected: string,
  condition: MatcherCondition,
): boolean {
  switch (condition) {
    case 0:
      return value.includes(expected);
    case 1:
      return value.startsWith(expected);
    case 2:
      return value.endsWith(expected);
    case 3:
      return value === expected;
    case 4:
      return true;
  }
}

export function matchUserMatcher(
  transaction: WalletTransaction,
  matchers: UserMatcher[],
  walletableName?: string,
): UserMatcher | undefined {
  return matchers.find((matcher) => {
    const amount = Math.abs(transaction.amount);
    return (
      matcher.active &&
      matcher.act === 1 &&
      matcher.entrySide === transaction.entrySide &&
      descriptionMatches(
        transaction.description,
        matcher.description,
        matcher.condition,
      ) &&
      (matcher.walletable === undefined ||
        matcher.walletable === walletableName) &&
      (matcher.minAmount === undefined || amount >= matcher.minAmount) &&
      (matcher.maxAmount === undefined || amount <= matcher.maxAmount)
    );
  });
}
