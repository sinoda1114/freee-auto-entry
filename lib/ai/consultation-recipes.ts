export type ConsultationRecipeContext = {
  question: string;
  historyText: string;
};

export type ConsultationRecipe = {
  id: string;
  match: (ctx: ConsultationRecipeContext) => boolean;
  prompt: string;
};

const MAX_RECIPES = 2;

const CONSUMPTION_TAX_PATTERN =
  /一般課税|簡易課税|みなし仕入|課税売上|課税仕入|消費税.*(比較|有利|得)|本則課税/;

const CONSUMPTION_TAX_RECIPE: ConsultationRecipe = {
  id: "consumption-tax",
  match: ({ question, historyText }) =>
    CONSUMPTION_TAX_PATTERN.test(question) ||
    CONSUMPTION_TAX_PATTERN.test(historyText),
  prompt: `一般課税と簡易課税の納付見込を比較する話題向けガイド:
- 税込／税抜は会計年度の経理方式設定から取得し、前提として明示する（ユーザーに聞かない）。
- 損益計算書は勘定科目単位で取得し、除外した科目名と金額を列挙してから課税仕入候補を合計する。
- 除外の目安例: 役員報酬、給料手当、賞与、法定福利費、租税公課、支払保険料、支払利息、法人税等。迷う科目は「課税候補に残した／除外した」を明示する。
- 根拠のない丸め推計で比較表を出さない。
- みなし仕入率／事業区分が不明なときだけ聞く。分かっていれば比較まで一気に進める。
- 結果は必ず「概算・要確認」とし、申告の最終判断はしない。`,
};

/** 登録順。先頭から評価し、最大 MAX_RECIPES 件まで返す */
export const CONSULTATION_RECIPES: ConsultationRecipe[] = [
  CONSUMPTION_TAX_RECIPE,
];

export function buildRecipeHistoryText(
  history: Array<{ content: string }>,
): string {
  return history
    .map((turn) => turn.content)
    .filter((content) => content.trim().length > 0)
    .join("\n");
}

export function selectRecipes(
  question: string,
  historyText: string,
): ConsultationRecipe[] {
  const ctx: ConsultationRecipeContext = {
    question,
    historyText,
  };
  const matched: ConsultationRecipe[] = [];
  for (const recipe of CONSULTATION_RECIPES) {
    if (recipe.match(ctx)) {
      matched.push(recipe);
      if (matched.length >= MAX_RECIPES) {
        break;
      }
    }
  }
  return matched;
}

export function appendRecipesToSystem(
  coreSystem: string,
  recipes: ConsultationRecipe[],
): string {
  if (recipes.length === 0) {
    return coreSystem;
  }
  const blocks = recipes.map(
    (recipe) => `## 追加ガイド（${recipe.id}）\n${recipe.prompt}`,
  );
  return `${coreSystem}\n\n${blocks.join("\n\n")}`;
}
