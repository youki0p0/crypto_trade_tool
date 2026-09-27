/**
 * 日本の暗号資産（暗号通貨）利益に対する税額シミュレーション。
 *
 * 純粋関数のみ。UI やネットワークに依存しない（クライアントでリアルタイム計算する）。
 *
 * ⚠️ 免責: 本計算は概算であり税務助言ではありません。均等割・各種所得控除・
 * 社会保険料控除・損益通算の細則などは考慮していません。正確な申告は税理士・
 * 国税庁の情報を確認してください。
 */

export type TaxMode = "current_progressive" | "separate_2028";

/** 所得税・累進速算表（課税所得金額に対する税率と控除額） 2024年時点 */
const INCOME_TAX_BRACKETS: { limit: number; rate: number; deduction: number }[] = [
  { limit: 1_950_000, rate: 0.05, deduction: 0 },
  { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
  { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
  { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
  { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
  { limit: Infinity, rate: 0.45, deduction: 4_796_000 },
];

/** 復興特別所得税率（所得税額に対して）2037年まで */
export const RECONSTRUCTION_RATE = 0.021;
/** 住民税率（課税所得に対して、概算・均等割は無視） */
export const RESIDENT_TAX_RATE = 0.1;

/** 2028年以降の申告分離課税（想定・未確定）: 所得税15% + 復興0.315% + 住民5% */
export const SEPARATE_TAX_RATE = 0.20315;

/** 課税所得金額に対する所得税額（1,000円未満切り捨てのうえ速算表を適用） */
export function incomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const base = Math.floor(taxableIncome / 1000) * 1000;
  const bracket = INCOME_TAX_BRACKETS.find((b) => base <= b.limit)!;
  return Math.max(0, base * bracket.rate - bracket.deduction);
}

/**
 * ある課税所得に対する「所得税＋復興特別所得税＋住民税」の合計（総合課税ベース）。
 */
export function totalComprehensiveTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const it = incomeTax(taxableIncome);
  const reconstruction = it * RECONSTRUCTION_RATE;
  const resident = taxableIncome * RESIDENT_TAX_RATE;
  return it + reconstruction + resident;
}

export interface TaxInput {
  /** 暗号資産の想定年間利益（円）。損失はマイナス。 */
  cryptoProfit: number;
  /** 他の課税所得（給与所得控除後などの概算・円） */
  otherIncome: number;
  /** 税率モード */
  mode: TaxMode;
}

export interface TaxResult {
  /** 暗号資産利益に帰属する概算税額（円） */
  taxAmount: number;
  /** 手取り利益（暗号資産利益 − 税額） */
  netProfit: number;
  /** 実効税率（税額 / 暗号資産利益）。利益0以下なら0。 */
  effectiveRate: number;
  /** 内訳（現行モードのみ意味を持つ。分離モードは合算値のみ） */
  breakdown: {
    incomeTax: number;
    reconstructionTax: number;
    residentTax: number;
  };
}

/**
 * 暗号資産利益にかかる税額を計算する。
 *
 * 現行（総合課税）: 暗号資産利益は「雑所得」として他の所得に上乗せされ累進課税される。
 *   帰属税額 = T(otherIncome + cryptoProfit) − T(otherIncome)
 *   （限界的に上に積み上がる分の税額。これが暗号資産利益に対する実質負担）
 *   ※ 雑所得の損失は給与所得等と損益通算できないため、利益が0以下なら税額0とする。
 *
 * 2028以降（申告分離課税・想定）: 他の所得と分離し、一律 20.315%。
 */
export function calculateTax(input: TaxInput): TaxResult {
  const cryptoProfit = Number.isFinite(input.cryptoProfit) ? input.cryptoProfit : 0;
  const otherIncome = Math.max(0, Number.isFinite(input.otherIncome) ? input.otherIncome : 0);

  // 利益が0以下: 課税なし（損益通算不可の前提）
  if (cryptoProfit <= 0) {
    return {
      taxAmount: 0,
      netProfit: cryptoProfit,
      effectiveRate: 0,
      breakdown: { incomeTax: 0, reconstructionTax: 0, residentTax: 0 },
    };
  }

  if (input.mode === "separate_2028") {
    const taxAmount = cryptoProfit * SEPARATE_TAX_RATE;
    return {
      taxAmount,
      netProfit: cryptoProfit - taxAmount,
      effectiveRate: SEPARATE_TAX_RATE,
      breakdown: {
        incomeTax: cryptoProfit * 0.15,
        reconstructionTax: cryptoProfit * 0.00315,
        residentTax: cryptoProfit * 0.05,
      },
    };
  }

  // current_progressive: 限界差分で暗号資産利益への帰属税額を求める
  const withCrypto = otherIncome + cryptoProfit;

  const itWith = incomeTax(withCrypto);
  const itOther = incomeTax(otherIncome);
  const incomeTaxDelta = Math.max(0, itWith - itOther);
  const reconstructionDelta = incomeTaxDelta * RECONSTRUCTION_RATE;
  const residentDelta = cryptoProfit * RESIDENT_TAX_RATE;

  const taxAmount = incomeTaxDelta + reconstructionDelta + residentDelta;

  return {
    taxAmount,
    netProfit: cryptoProfit - taxAmount,
    effectiveRate: taxAmount / cryptoProfit,
    breakdown: {
      incomeTax: incomeTaxDelta,
      reconstructionTax: reconstructionDelta,
      residentTax: residentDelta,
    },
  };
}
