// 調査結果からの「下書き本文」を /support/new へ引き継ぐための一時ストア。
// 本文には問い合わせメールの断片や調査要約など機密が含まれ得るため、
// URL クエリ (?raw=) に載せない（アクセスログ・ブラウザ履歴・共有リンクへの
// 二次漏洩を防ぐ）。同一タブ内の sessionStorage で受け渡し、取り出したら消す。
export const SUPPORT_DRAFT_STORAGE_KEY = "freee:support-new-draft";

export function stashSupportDraft(rawEmail: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(SUPPORT_DRAFT_STORAGE_KEY, rawEmail);
  } catch {
    // sessionStorage が使えない場合は下書き引き継ぎを諦める（URL には載せない）
  }
}

export function takeSupportDraft(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const value = window.sessionStorage.getItem(SUPPORT_DRAFT_STORAGE_KEY);
    if (value !== null) {
      window.sessionStorage.removeItem(SUPPORT_DRAFT_STORAGE_KEY);
      return value;
    }
  } catch {
    // 取り出し失敗時は空扱い
  }
  return "";
}
