import { describe, expect, it } from "vitest";
import {
  appendRecipesToSystem,
  buildRecipeHistoryText,
  selectRecipes,
} from "./consultation-recipes";

describe("selectRecipes", () => {
  it("matches consumption-tax on the current question", () => {
    const recipes = selectRecipes(
      "一般課税と簡易課税どっちが得？ ITサービス",
      "",
    );
    expect(recipes.map((r) => r.id)).toEqual(["consumption-tax"]);
  });

  it("matches consumption-tax from history when the follow-up is vague", () => {
    const historyText = buildRecipeHistoryText([
      { content: "簡易課税と一般課税の比較をお願い" },
      { content: "みなし仕入率は50%です。" },
    ]);
    const recipes = selectRecipes("それを調べて", historyText);
    expect(recipes.map((r) => r.id)).toEqual(["consumption-tax"]);
  });

  it("does not match unrelated questions", () => {
    const recipes = selectRecipes("この振替はなぜ現金？", "");
    expect(recipes).toEqual([]);
  });

  it("does not match PL display alone", () => {
    const recipes = selectRecipes("損益計算書を表示して", "");
    expect(recipes).toEqual([]);
  });
});

describe("appendRecipesToSystem", () => {
  it("keeps core when no recipes match", () => {
    expect(appendRecipesToSystem("CORE", [])).toBe("CORE");
  });

  it("appends recipe blocks with ids", () => {
    const recipes = selectRecipes("消費税の比較", "");
    const system = appendRecipesToSystem("CORE", recipes);
    expect(system.startsWith("CORE")).toBe(true);
    expect(system).toContain("## 追加ガイド（consumption-tax）");
    expect(system).toContain("概算・要確認");
  });
});
