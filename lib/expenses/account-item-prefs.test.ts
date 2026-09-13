import { describe, expect, it } from "vitest";
import {
  FAVORITE_ACCOUNT_ITEM_LIMIT,
  RECENT_ACCOUNT_ITEM_LIMIT,
  loadFavoriteAccountItemIds,
  loadRecentAccountItemIds,
  recordRecentAccountItemId,
  resolveAccountItemsByIds,
  toggleFavoriteAccountItemId,
  type AccountItemPrefsStorage,
} from "./account-item-prefs";

function memoryStorage(): AccountItemPrefsStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

describe("account-item-prefs", () => {
  it("records recent ids newest-first and dedupes", () => {
    const storage = memoryStorage();
    recordRecentAccountItemId("c1", 10, storage);
    recordRecentAccountItemId("c1", 20, storage);
    recordRecentAccountItemId("c1", 10, storage);
    expect(loadRecentAccountItemIds("c1", storage)).toEqual([10, 20]);
  });

  it("caps recent list length", () => {
    const storage = memoryStorage();
    for (let id = 1; id <= RECENT_ACCOUNT_ITEM_LIMIT + 3; id += 1) {
      recordRecentAccountItemId("c1", id, storage);
    }
    const recent = loadRecentAccountItemIds("c1", storage);
    expect(recent).toHaveLength(RECENT_ACCOUNT_ITEM_LIMIT);
    expect(recent[0]).toBe(RECENT_ACCOUNT_ITEM_LIMIT + 3);
  });

  it("toggles favorites and caps length", () => {
    const storage = memoryStorage();
    expect(toggleFavoriteAccountItemId("c1", 5, storage)).toEqual([5]);
    expect(toggleFavoriteAccountItemId("c1", 5, storage)).toEqual([]);
    for (let id = 1; id <= FAVORITE_ACCOUNT_ITEM_LIMIT + 2; id += 1) {
      toggleFavoriteAccountItemId("c1", id, storage);
    }
    expect(loadFavoriteAccountItemIds("c1", storage)).toHaveLength(
      FAVORITE_ACCOUNT_ITEM_LIMIT,
    );
  });

  it("scopes prefs by companyId", () => {
    const storage = memoryStorage();
    recordRecentAccountItemId("a", 1, storage);
    recordRecentAccountItemId("b", 2, storage);
    expect(loadRecentAccountItemIds("a", storage)).toEqual([1]);
    expect(loadRecentAccountItemIds("b", storage)).toEqual([2]);
  });

  it("drops unknown ids when resolving against master", () => {
    expect(
      resolveAccountItemsByIds(
        [
          { id: 1, name: "消耗品費" },
          { id: 2, name: "通信費" },
        ],
        [2, 99, 1],
      ),
    ).toEqual([
      { id: 2, name: "通信費" },
      { id: 1, name: "消耗品費" },
    ]);
  });
});
