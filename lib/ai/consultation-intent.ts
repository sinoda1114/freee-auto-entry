import type { FiscalYear } from "@/lib/freee/company";

export type ConsultationIntentKind =
  | "report_pl"
  | "report_bs"
  | "report_both"
  | "ledger"
  | "record"
  | "general";

/** present=数字の提示 / investigate=なぜ調査（事実・仮説・確認・修正案） */
export type ConsultationResponseMode = "present" | "investigate";

export interface ConsultationIntent {
  kind: ConsultationIntentKind;
  responseMode: ConsultationResponseMode;
  wantsPl: boolean;
  wantsBs: boolean;
  wantsLedger: boolean;
  /** 質問から抽出した勘定科目名（元帳深掘り用） */
  accountItemName: string | null;
  /** ユーザーが言及した年度ヒント（未解決） */
  fiscalHint: FiscalYearHint | null;
}

export type FiscalYearHint =
  | { type: "current" }
  | { type: "previous" }
  | { type: "year"; year: number };

export interface ResolvedFiscalPeriod {
  label: string;
  startDate: string;
  endDate: string;
  fiscalYear: number;
}

const PL_PATTERN =
  /損益計算書|損益|試算表|ＰＬ|\bPL\b|\bP\/L\b|profit\s*and\s*loss|income\s*statement/i;
const BS_PATTERN =
  /貸借対照表|貸借対照|貸借|ＢＳ|\bBS\b|\bB\/S\b|balance\s*sheet/i;
const LEDGER_PATTERN = /総勘定元帳|元帳|general\s*ledger/i;
const REPORT_OR_NUMBER_PATTERN =
  /損益|貸借|試算表|元帳|売上|利益|費用|資産|負債|純資産|今期|前期|年度|決算|数字|金額|見(て|る)|閲覧|確認/i;
const INVESTIGATE_PATTERN =
  /なぜ|何故|おかしい|原因|仮説|修正|問題|怪しい|調べて|分析して|どうして|間違|ミス|消込/;
const PRESENT_PATTERN =
  /表示|見せて|見せて|見せろ|教えて|ポイント|要約|一覧|どうなってる|いくら|金額は|見て/;

/**
 * レポート表示依頼か、なぜ調査か。レポート系はデフォルト present。
 */
export function detectResponseMode(
  question: string,
  kind: ConsultationIntentKind,
): ConsultationResponseMode {
  if (INVESTIGATE_PATTERN.test(question)) {
    return "investigate";
  }
  if (
    kind === "report_pl" ||
    kind === "report_bs" ||
    kind === "report_both" ||
    kind === "ledger"
  ) {
    return "present";
  }
  if (kind === "record") {
    return "investigate";
  }
  if (PRESENT_PATTERN.test(question)) {
    return "present";
  }
  return "investigate";
}

/**
 * 質問文から相談意図を判定する（モード切替UIなしの振り分け用）
 */
export function detectConsultationIntent(
  question: string,
  hasRecordTarget: boolean,
): ConsultationIntent {
  const wantsPl = PL_PATTERN.test(question);
  const wantsBs = BS_PATTERN.test(question);
  const wantsLedger = LEDGER_PATTERN.test(question);
  const fiscalHint = parseFiscalYearHint(question);
  const accountItemName = extractAccountItemName(question);

  let kind: ConsultationIntentKind;
  if (wantsPl && wantsBs) {
    kind = "report_both";
  } else if (wantsPl) {
    kind = "report_pl";
  } else if (wantsBs) {
    kind = "report_bs";
  } else if (wantsLedger) {
    kind = "ledger";
  } else if (hasRecordTarget) {
    kind = "record";
  } else if (fiscalHint || REPORT_OR_NUMBER_PATTERN.test(question)) {
    // 「25年度の損益…」や数字系の一般質問は PL を優先して取る
    kind = wantsBs ? "report_bs" : "report_pl";
  } else {
    kind = "general";
  }

  // 試算表は PL+BS 両方
  if (/試算表/.test(question)) {
    kind = "report_both";
  }

  return {
    kind,
    responseMode: detectResponseMode(question, kind),
    wantsPl:
      kind === "report_pl" ||
      kind === "report_both" ||
      (kind === "ledger" && !wantsBs) ||
      (kind === "general" && Boolean(fiscalHint)),
    wantsBs: kind === "report_bs" || kind === "report_both",
    wantsLedger: wantsLedger || Boolean(accountItemName && (wantsPl || wantsBs)),
    accountItemName,
    fiscalHint,
  };
}

/** 「25年度」「2025年度」「今期」「前期」などを抽出 */
export function parseFiscalYearHint(text: string): FiscalYearHint | null {
  if (/今期|当期|今年度|本年度/.test(text)) {
    return { type: "current" };
  }
  if (/前期|前年度|昨年度/.test(text)) {
    return { type: "previous" };
  }

  const fullYear = text.match(/(20\d{2})\s*年度?/);
  if (fullYear) {
    return { type: "year", year: Number(fullYear[1]) };
  }

  // 「25年度」→ 2000年代として解釈（会計の口語では西暦下2桁が多い）
  const shortYear = text.match(/(?<!\d)(\d{2})\s*年度?/);
  if (shortYear) {
    const yy = Number(shortYear[1]);
    return { type: "year", year: 2000 + yy };
  }

  return null;
}

/**
 * 会社の会計年度一覧から、ヒントに対応する期間を解決する。
 * freee の fiscal_year ズレ回避のため start_date/end_date を返す。
 */
export function resolveFiscalPeriod(
  fiscalYears: FiscalYear[],
  hint: FiscalYearHint | null,
  todayIsoDate: string = new Date().toISOString().slice(0, 10),
): ResolvedFiscalPeriod | null {
  if (fiscalYears.length === 0) {
    return null;
  }

  const sorted = [...fiscalYears].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );

  const current =
    sorted.find(
      (fy) => fy.startDate <= todayIsoDate && fy.endDate >= todayIsoDate,
    ) ?? sorted[0];

  let selected = current;
  if (hint?.type === "previous") {
    const currentIndex = sorted.findIndex((fy) => fy.id === current.id);
    selected = sorted[currentIndex + 1] ?? current;
  } else if (hint?.type === "year") {
    const byStartYear = sorted.find(
      (fy) => Number(fy.startDate.slice(0, 4)) === hint.year,
    );
    const containing = sorted.find(
      (fy) =>
        fy.startDate.slice(0, 4) <= String(hint.year) &&
        fy.endDate.slice(0, 4) >= String(hint.year),
    );
    selected = byStartYear ?? containing ?? current;
  }

  if (!selected) {
    return null;
  }

  const fiscalYear = Number(selected.startDate.slice(0, 4));
  return {
    label: `${fiscalYear}年度（${selected.startDate}〜${selected.endDate}${
      selected.isClosed ? "・締め済" : ""
    }）`,
    startDate: selected.startDate,
    endDate: selected.endDate,
    fiscalYear,
  };
}

/** 「〇〇の内訳」「科目 旅費交通費」などから科目名を雑に抽出 */
export function extractAccountItemName(question: string): string | null {
  const quoted = question.match(/[「『]([^」』]{1,40})[」』]/);
  if (quoted?.[1] && !/年度|損益|貸借|試算/.test(quoted[1])) {
    return quoted[1].trim();
  }

  const labeled = question.match(
    /(?:勘定科目|科目)[：:\s]*([^\s、。，,]{1,40})/,
  );
  if (labeled?.[1]) {
    return labeled[1].trim();
  }

  const known = question.match(
    /(売上高|売上原価|売掛金|買掛金|現金|普通預金|旅費交通費|交際費|消耗品費|支払手数料|外注費|給与手当|役員報酬|地代家賃|減価償却費|当期純利益|営業利益|経常利益)/,
  );
  return known?.[1] ?? null;
}

/** レポート取得が必要か（スクショのような「損益見れる？」も含む） */
export function shouldFetchReports(intent: ConsultationIntent): boolean {
  return (
    intent.wantsPl ||
    intent.wantsBs ||
    intent.wantsLedger ||
    intent.kind === "report_pl" ||
    intent.kind === "report_bs" ||
    intent.kind === "report_both" ||
    intent.kind === "ledger"
  );
}
