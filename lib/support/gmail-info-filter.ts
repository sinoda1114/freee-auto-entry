/**
 * Heuristics to drop freee broadcast / thin operational mail
 * from one-shot Gmail support-history import.
 */

const INFO_SUBJECT_PATTERNS = [
  /重要なお知らせ/,
  /本日ご予約の電話サポート/,
  /パスキー・二要素認証/,
  /会員規約改定/,
  /メンテナンスに伴う/,
  /ポイント付与の対象外/,
  /パスワードの無効化/,
  /※再送※/,
  /機能リリース/,
  /口座振込のお願い/,
];

const THIN_SUBJECT_PATTERNS = [
  /^【freeeサポートデスク】チャットサポートをご利用いただきありがとうございます。?$/,
  /^【freeeサポート】お問い合わせいただきありがとうございます$/,
];

export function isInformationalSupportMail(input: {
  subject: string;
  from: string;
  body?: string;
}): boolean {
  const subject = input.subject.trim();
  const from = input.from.trim();

  if (INFO_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    return true;
  }

  if (THIN_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) {
    return true;
  }

  // Broadcast desk (not 1:1 support replies). Keep 「お問い合わせ履歴を送信」.
  if (
    /freeeサポートデスク/.test(from) &&
    !/お問い合わせ履歴を送信/.test(subject)
  ) {
    return true;
  }

  const body = input.body?.trim() ?? "";
  if (body && body.length < 80 && /チャットサポートをご利用/.test(subject)) {
    return true;
  }

  return false;
}

export function extractEmbeddedThreadId(subject: string): string | null {
  const match = subject.match(/\[\s*thread::([^:\]]+)::\s*\]/i);
  return match?.[1]?.trim() || null;
}
