/** Suica 履歴ブロック（16バイト）のパースと、アプリ↔Web 引き渡しペイロード。 */

export const SUICA_HISTORY_SERVICE_CODE = 0x090f;
export const SUICA_SYSTEM_CODE = 0x0003;
export const SUICA_HISTORY_BLOCK_COUNT = 20;

export interface SuicaHistoryRecord {
  /** YYYY-MM-DD。日付が無効なレコードは null */
  date: string | null;
  processType: number;
  terminalType: number;
  entranceCode: number;
  exitCode: number;
  balance: number;
  sequence: number;
  region: number;
  rawHex: string;
}

export interface SuicaTransitItem {
  date: string;
  amount: number;
  balance: number;
  processType: number;
  entranceCode: number;
  exitCode: number;
  region: number;
  sequence: number;
  description: string;
}

export interface SuicaHandoffPayload {
  v: 1;
  items: SuicaTransitItem[];
}

/** 運賃・物販など経費化しやすい利用種別 */
const EXPENSE_PROCESS_TYPES = new Set([
  0x01, // 運賃
  0x02, // チャージ
  0x0f, // バス
  0x46, // 物販
  0x49, // 物販キャンセル
]);

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/\s+/g, "").toLowerCase();
  if (normalized.length % 2 !== 0) {
    throw new Error("hex length must be even");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function readU16Be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU16Le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/** Suica 履歴1ブロック（16バイト）をパースする。空ブロックは null。 */
export function parseSuicaHistoryBlock(
  block: Uint8Array,
): SuicaHistoryRecord | null {
  if (block.length < 16) return null;
  if (block.every((b) => b === 0)) return null;

  const dateWord = readU16Be(block, 4);
  const year = 2000 + (dateWord >> 9);
  const month = (dateWord >> 5) & 0x0f;
  const day = dateWord & 0x1f;
  const dateValid =
    month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000;
  const date = dateValid
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;

  return {
    date,
    terminalType: block[0] ?? 0,
    processType: block[1] ?? 0,
    entranceCode: readU16Be(block, 6),
    exitCode: readU16Be(block, 8),
    balance: readU16Le(block, 10),
    sequence: readU16Be(block, 13) >> 4,
    region: block[15] ?? 0,
    rawHex: bytesToHex(block.subarray(0, 16)),
  };
}

export function parseSuicaHistoryBlocks(
  data: Uint8Array,
): SuicaHistoryRecord[] {
  const records: SuicaHistoryRecord[] = [];
  for (let offset = 0; offset + 16 <= data.length; offset += 16) {
    const record = parseSuicaHistoryBlock(data.subarray(offset, offset + 16));
    if (record) records.push(record);
  }
  return records;
}

export function formatStationCode(code: number): string {
  return `駅${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function describeSuicaRecord(record: SuicaHistoryRecord): string {
  const process = processTypeLabel(record.processType);
  const from = formatStationCode(record.entranceCode);
  const to = formatStationCode(record.exitCode);
  if (record.processType === 0x46 || record.processType === 0x49) {
    return `Suica ${process}`;
  }
  return `Suica ${process} ${from}→${to}`;
}

export function processTypeLabel(processType: number): string {
  switch (processType) {
    case 0x01:
      return "運賃";
    case 0x02:
      return "チャージ";
    case 0x0f:
      return "バス";
    case 0x46:
      return "物販";
    case 0x49:
      return "物販取消";
    default:
      return `種別0x${processType.toString(16)}`;
  }
}

/**
 * 新しい順の履歴から運賃を算出する。
 * 残額差分（次レコード残額 − 当レコード残額）を基本とし、負なら絶対値を使う。
 */
export function toTransitItems(
  records: SuicaHistoryRecord[],
): SuicaTransitItem[] {
  const items: SuicaTransitItem[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!record?.date) continue;
    if (!EXPENSE_PROCESS_TYPES.has(record.processType)) continue;
    // チャージは経費にしない
    if (record.processType === 0x02) continue;

    const older = records[i + 1];
    let amount = 0;
    if (older) {
      amount = older.balance - record.balance;
    }
    if (amount <= 0) {
      // 物販などで差分が取れない場合はスキップ（残額だけでは運賃不明）
      continue;
    }

    items.push({
      date: record.date,
      amount,
      balance: record.balance,
      processType: record.processType,
      entranceCode: record.entranceCode,
      exitCode: record.exitCode,
      region: record.region,
      sequence: record.sequence,
      description: describeSuicaRecord(record),
    });
  }

  return items;
}

function toBase64Url(bytes: Uint8Array): string {
  let b64: string;
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(bytes).toString("base64");
  } else {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  if (typeof atob === "function") {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function encodeSuicaHandoffPayload(
  payload: SuicaHandoffPayload,
): string {
  const json = JSON.stringify(payload);
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeSuicaHandoffPayload(
  encoded: string,
): SuicaHandoffPayload {
  const json = new TextDecoder().decode(fromBase64Url(encoded.trim()));
  const parsed = JSON.parse(json) as SuicaHandoffPayload;
  if (parsed.v !== 1 || !Array.isArray(parsed.items)) {
    throw new Error("不正な Suica 引き渡しペイロードです。");
  }
  for (const item of parsed.items) {
    if (
      typeof item.date !== "string" ||
      typeof item.amount !== "number" ||
      typeof item.description !== "string" ||
      item.amount <= 0
    ) {
      throw new Error("Suica 明細の形式が不正です。");
    }
  }
  return parsed;
}

export function buildSuicaExpenseUrl(
  siteUrl: string,
  items: SuicaTransitItem[],
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const p = encodeSuicaHandoffPayload({ v: 1, items });
  return `${base}/expenses/suica?p=${p}`;
}

/** 旅費交通費っぽい勘定科目を優先して選ぶ */
export function pickTravelAccountItemId(
  accountItems: Array<{ id: number; name: string }>,
): number | null {
  const preferred = accountItems.find((item) =>
    /旅費|交通費|電車|乗車券/.test(item.name),
  );
  return preferred?.id ?? accountItems[0]?.id ?? null;
}
