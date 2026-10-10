import { describe, expect, it } from "vitest";
import { mergeRecentExpenses, type RecentExpenseRow } from "./recent-expense-list";

function row(id: number, issueDate = "2026-10-01"): RecentExpenseRow {
  return {
    id,
    issueDate,
    amount: id,
    description: `内容${id}`,
    accountItemName: "消耗品費",
  };
}

describe("mergeRecentExpenses", () => {
  it("keeps a just-registered row the server list does not have yet", () => {
    const serverRows = [5, 4, 3, 2, 1].map((id) => row(id));
    const registered = row(9000, "2020-01-01");

    const merged = mergeRecentExpenses(serverRows, [registered]);

    expect(merged.map((expense) => expense.id)).toEqual([9000, 5, 4, 3, 2]);
    expect(merged[0]?.issueDate).toBe("2020-01-01");
  });

  it("does not duplicate a row once the server list includes it", () => {
    const registered = row(9000, "2020-01-01");
    const serverRows = [registered, row(5), row(4)];

    const merged = mergeRecentExpenses(serverRows, [registered]);

    expect(merged.map((expense) => expense.id)).toEqual([9000, 5, 4]);
  });
});
