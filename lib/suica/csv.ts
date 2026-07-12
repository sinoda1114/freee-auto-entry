import type { SuicaTransitItem } from "./history";

const CHARGE_KEYWORDS = /チャージ|現金|オート|入金|繰越|繰り越し|\+/;

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
  return value.replace(/[\s_]+/g, "").toLowerCase();
}

type ColumnMap = {
  date?: number;
  /** 支出金額（Value / Out Value / 金額） */
  amount?: number;
  /** 入金側（In Value）。チャージ判定用 */
  inAmount?: number;
  balance?: number;
  type?: number;
  company?: number;
  from?: number;
  to?: number;
  place?: number;
  detail?: number;
};

/**
 * 読取アプリ（英語ヘッダ）と日本語ヘッダの両方を検出する。
 * 例: Date, Title, Value, Out Value, Balance Value, In Station, Out Station
 */
export function detectColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};

  header.forEach((raw, index) => {
    const h = normalizeHeader(raw);

    if (map.date == null && /^(利用日|利用年月日|年月日|日付|date)$/.test(h)) {
      map.date = index;
      return;
    }
    // Balance Value を金額より先に確定
    if (map.balance == null && /(残高|残額|balance)/.test(h)) {
      map.balance = index;
      return;
    }
    if (map.inAmount == null && /^(invalue|入金額)$/.test(h)) {
      map.inAmount = index;
      return;
    }
    // Out Value を優先して amount に
    if (/(outvalue|利用額|差額|運賃|amount|fare|金額)/.test(h)) {
      if (map.amount == null || /outvalue/.test(h)) {
        map.amount = index;
      }
      return;
    }
    // 単独の Value（英語読取アプリ）
    if (map.amount == null && /^value$/.test(h)) {
      map.amount = index;
      return;
    }
    if (
      map.type == null &&
      /^(title|種別|利用種別|処理|券種)$/.test(h)
    ) {
      map.type = index;
      return;
    }
    if (
      map.company == null &&
      /^(companyname|会社|事業者|鉄道会社)$/.test(h)
    ) {
      map.company = index;
      return;
    }
    if (
      map.from == null &&
      /^(instation|入場|乗車|発駅|入駅|entrance|fromstation)$/.test(h)
    ) {
      map.from = index;
      return;
    }
    if (
      map.to == null &&
      /^(outstation|出場|降車|着駅|出駅|exit|tostation)$/.test(h)
    ) {
      map.to = index;
      return;
    }
    if (
      map.place == null &&
      /^(利用場所|利用内容|区間|詳細|内容)$/.test(h)
    ) {
      map.place = index;
      return;
    }
    if (map.detail == null && /^(備考|メモ|memo|note)$/.test(h)) {
      map.detail = index;
    }
  });

  return map;
}

function looksLikeHeader(row: string[]): boolean {
  const joined = row.map(normalizeHeader).join(",");
  return /(日付|年月日|利用日|^date$|,date,)/.test(`,${joined},`);
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
  const negative = /[-−▲]/.test(raw) || raw.includes("(");
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

function resolveExpenseAmount(
  row: string[],
  columns: ColumnMap,
): number | null {
  const valueCell = cell(row, columns.amount);
  const inCell = cell(row, columns.inAmount);

  // Value が +¥... の入金表示なら経費にしない
  if (/^\s*\+/.test(valueCell) || CHARGE_KEYWORDS.test(valueCell)) {
    return null;
  }

  // Out Value / Value を優先。空ならスキップ（In Value だけのチャージ行）
  const fromAmountCol = parseAmountYen(valueCell);
  if (fromAmountCol != null && fromAmountCol !== 0) {
    return Math.abs(fromAmountCol);
  }

  // 金額列が空で In Value だけある → チャージ扱い
  if (inCell && parseAmountYen(inCell) != null) {
    return null;
  }

  return null;
}

/**
 * Suica / ICカード読取アプリ等の CSV を経費候補に変換する。
 * チャージ行は除外。
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
      "日付列が見つかりません。ヘッダに「利用日」「Date」などを含めてください。",
    );
  }
  if (columns.amount == null) {
    throw new Error(
      "金額列が見つかりません。ヘッダに「金額」「Value」「Out Value」などを含めてください。",
    );
  }

  const items: SuicaTransitItem[] = [];
  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i]!;
    const date = parseDate(cell(row, columns.date));
    if (!date) continue;

    const type = cell(row, columns.type);
    const company = cell(row, columns.company);
    const place = cell(row, columns.place);
    const from = cell(row, columns.from);
    const to = cell(row, columns.to);
    const detail = cell(row, columns.detail);
    const combinedType = `${type} ${company} ${place} ${detail}`;

    if (CHARGE_KEYWORDS.test(combinedType)) {
      continue;
    }

    const amount = resolveExpenseAmount(row, columns);
    if (amount == null || amount <= 0) continue;

    const route =
      from && to
        ? `${from}→${to}`
        : from || to || place || company || type || "交通";
    const label = [type, company].filter(Boolean).join(" ");
    const description = `Suica ${label || "利用"} ${route}`.trim();

    const balance = parseAmountYen(cell(row, columns.balance));

    items.push({
      date,
      amount,
      balance: balance != null ? Math.abs(balance) : 0,
      processType: /物販|購/.test(combinedType)
        ? 0x46
        : /バス/.test(combinedType)
          ? 0x0f
          : 0x01,
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
