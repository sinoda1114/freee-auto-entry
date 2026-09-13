/** Browser localStorage for expense account-item prefs (per company). */

export const RECENT_ACCOUNT_ITEM_LIMIT = 8;
export const FAVORITE_ACCOUNT_ITEM_LIMIT = 12;

export type AccountItemPrefsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): AccountItemPrefsStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    // Private mode / blocked storage
    return null;
  }
}

function recentKey(companyId: string): string {
  return `expense.accountItems.recent.${companyId}`;
}

function favoriteKey(companyId: string): string {
  return `expense.accountItems.favorites.${companyId}`;
}

function readIdList(
  storage: AccountItemPrefsStorage | null,
  key: string,
): number[] {
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const ids: number[] = [];
    for (const value of parsed) {
      const id = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(id) && id > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

function writeIdList(
  storage: AccountItemPrefsStorage | null,
  key: string,
  ids: number[],
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore quota / security errors
  }
}

export function loadRecentAccountItemIds(
  companyId: string,
  storage: AccountItemPrefsStorage | null = defaultStorage(),
): number[] {
  return readIdList(storage, recentKey(companyId)).slice(
    0,
    RECENT_ACCOUNT_ITEM_LIMIT,
  );
}

export function recordRecentAccountItemId(
  companyId: string,
  accountItemId: number,
  storage: AccountItemPrefsStorage | null = defaultStorage(),
): number[] {
  if (!Number.isFinite(accountItemId) || accountItemId <= 0) {
    return loadRecentAccountItemIds(companyId, storage);
  }
  const next = [
    accountItemId,
    ...loadRecentAccountItemIds(companyId, storage).filter(
      (id) => id !== accountItemId,
    ),
  ].slice(0, RECENT_ACCOUNT_ITEM_LIMIT);
  writeIdList(storage, recentKey(companyId), next);
  return next;
}

export function loadFavoriteAccountItemIds(
  companyId: string,
  storage: AccountItemPrefsStorage | null = defaultStorage(),
): number[] {
  return readIdList(storage, favoriteKey(companyId)).slice(
    0,
    FAVORITE_ACCOUNT_ITEM_LIMIT,
  );
}

export function toggleFavoriteAccountItemId(
  companyId: string,
  accountItemId: number,
  storage: AccountItemPrefsStorage | null = defaultStorage(),
): number[] {
  if (!Number.isFinite(accountItemId) || accountItemId <= 0) {
    return loadFavoriteAccountItemIds(companyId, storage);
  }
  const current = loadFavoriteAccountItemIds(companyId, storage);
  const next = current.includes(accountItemId)
    ? current.filter((id) => id !== accountItemId)
    : [accountItemId, ...current].slice(0, FAVORITE_ACCOUNT_ITEM_LIMIT);
  writeIdList(storage, favoriteKey(companyId), next);
  return next;
}

export function resolveAccountItemsByIds(
  accountItems: Array<{ id: number; name: string }>,
  ids: number[],
): Array<{ id: number; name: string }> {
  const byId = new Map(accountItems.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
