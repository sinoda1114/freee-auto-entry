import type { SuicaTransitItem } from "./history";

const CHARGE_KEYWORDS = /チャージ|現金|オート|入金|繰越|繰り越し/;
const SKIP_TYPE_KEYWORDS = /チャージ|現金|オート|入金|繰越/;

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

/** 簡易 CSV 行分割（ダブルクォート対応） */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const input = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

type ColumnRole =
  | "date"
  | "amount"
  | "balance"
  | "type"
  | "from"
  | "to"
  | "place"
  | "detail";

function detectColumns(header: string[]): Partial<Record<ColumnRole, number>> {
  const map: Partial<Record<ColumnRole, number>> = {};
  header.forEach((raw, index) => {
    const h = normalizeHeader(raw);
    if (
      map.date == null &&
      /(利用日|利用年月日|年月日|日付|date)/.test(h)
    ) {
      map.date = index;
    } else if (
      map.amount == null &&
      /(金額|利用額|差額|運賃|amount|fare)/.test(h)
    ) {
      map.amount = index;
    } else if (map.balance == null && /(残高|残額|balance)/.test(h)) {
      map.balance = index;
    } else if (
      map.type == null &&
      /(種別|利用種別|処理|券種|type)/.test(h)
    ) {
      map.type = index;
    } else if (
      map.from == null &&
      /(入場|乗車|発駅|入駅|from|entrance)/.test(h)
    ) {
      map.from = index;
    } else if (
      map.to == null &&
      /(出場|降車|着駅|出駅|to|exit)/.test(h)
    ) {
      map.to = index;
    } else if (
      map.place == null &&
      /(利用場所|利用内容|区間|詳細|内容|station)/.test(h)
    ) {
      map.place = index;
    } else if (map.detail == null && /(備考|メモ|note)/.test(h)) {
      map.detail = index;
    }
  });
  return map;
}

function looksLikeHeader(row: string[]): boolean {
  const joined = row.map(normalizeHeader).join(",");
  return /(日付|年月日|利用日|date)/.test(joined);
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (iso) {
    const y = iso[1]!;
    const m = iso[2]!.padStart(2, "0");
    const d = iso[3]!.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const jp = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jp) {
    return `${jp[1]}-${jp[2]!.padStart(2, "0")}-${jp[3]!.padStart(2, "0")}`;
  }
  return null;
}

function parseAmountYen(raw: string): number | null {
  if (!raw.trim()) return null;
  const negative = /[-−▲△△]|▲/.test(raw) || raw.includes("(");
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function cell(row: string[], index: number | undefined): string {
  if (index == null) return "";
  return row[index] ?? "";
}

/**
 * Suica / ICカード読取アプリ等の CSV を経費候補に変換する。
 * チャージ行は除外。金額列が負なら絶対値、正ならそのまま支出として扱う。
 */
export function parseSuicaCsv(text: string): SuicaTransitItem[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new Error("CSV にデータがありません。");
  }

  let start = 0;
  let columns = detectColumns(rows[0] ?? []);
  if (looksLikeHeader(rows[0] ?? []) && columns.date != null) {
    start = 1;
  } else {
    // ヘッダなし: 先頭列=日付, 金額らしき列を推定
    columns = {
      date: 0,
      type: rows[0] && rows[0].length > 1 ? 1 : undefined,
      place: rows[0] && rows[0].length > 2 ? 2 : undefined,
      amount: rows[0] && rows[0].length > 3 ? 3 : 1,
      balance: rows[0] && rows[0].length > 4 ? 4 : undefined,
    };
  }

  if (columns.date == null) {
    throw new Error(
      "日付列が見つかりません。ヘッダに「利用日」「日付」などを含めてください。",
    );
  }

  const items: SuicaTransitItem[] = [];
  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i]!;
    const date = parseDate(cell(row, columns.date));
    if (!date) continue;

    const type = cell(row, columns.type);
    const place = cell(row, columns.place);
    const from = cell(row, columns.from);
    const to = cell(row, columns.to);
    const detail = cell(row, columns.detail);
    const combinedType = `${type} ${place} ${detail}`;

    if (SKIP_TYPE_KEYWORDS.test(combinedType) || CHARGE_KEYWORDS.test(type)) {
      continue;
    }

    const amountRaw = parseAmountYen(cell(row, columns.amount));
    // 金額列がなく残高だけの形式はスキップ（差分推定はしない）
    if (amountRaw == null || amountRaw === 0) continue;

    // 正の金額=支出、負の金額=支出（符号付きエクスポート）の両方に対応
    const amount = Math.abs(amountRaw);
    if (amount <= 0) continue;

    // チャージが金額プラスで出る場合（入金）を種別で弾き切れなかったら、
    // 「現金」「オート」以外で金額だけ大きい行は通す（手動選択で除外可能）

    const route =
      from && to
        ? `${from}→${to}`
        : place || detail || type || "交通";
    const description = `Suica ${type || "利用"} ${route}`.trim();

    const balance = parseAmountYen(cell(row, columns.balance));

    items.push({
      date,
      amount,
      balance: balance != null ? Math.abs(balance) : 0,
      processType: /物販|購/.test(combinedType) ? 0x46 : 0x01,
      entranceCode: 0,
      exitCode: 0,
      region: 0,
      sequence: i,
      description,
    });
  }

  if (items.length === 0) {
    throw new Error(
      "経費にできる明細がありませんでした。チャージ以外の行と金額列があるか確認してください。",
    );
  }

  return items;
}
