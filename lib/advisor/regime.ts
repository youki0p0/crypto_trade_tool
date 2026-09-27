/**
 * レジーム判定（純粋関数）。会議の裁定に基づく:
 * ADX(14)でトレンド強度、終値vsEMA200で方向、正規化ATRの分位でボラ状態。
 */
import type { Candle } from "@/lib/models/types";
import { ema } from "@/lib/models/indicators";

export type Regime = "strong_up" | "strong_down" | "range" | "transition" | "unknown";

export const REGIME_LABEL: Record<Regime, string> = {
  strong_up: "強気トレンド",
  strong_down: "弱気トレンド",
  range: "レンジ",
  transition: "遷移",
  unknown: "判定不能",
};

/** True Range 系列 */
function trueRanges(c: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < c.length; i++) {
    if (i === 0) {
      tr.push(c[i].high - c[i].low);
      continue;
    }
    const pc = c[i - 1].close;
    tr.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - pc), Math.abs(c[i].low - pc)));
  }
  return tr;
}

/** ATR (Wilder) */
export function atr(c: Candle[], period = 14): (number | null)[] {
  const tr = trueRanges(c);
  const out: (number | null)[] = new Array(c.length).fill(null);
  if (c.length <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < c.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** ADX (Wilder) */
export function adx(c: Candle[], period = 14): (number | null)[] {
  const n = c.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period * 2) return out;

  const tr = trueRanges(c);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = c[i].high - c[i - 1].high;
    const down = c[i - 1].low - c[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  // Wilder 平滑
  let trS = 0, pS = 0, mS = 0;
  for (let i = 1; i <= period; i++) {
    trS += tr[i];
    pS += plusDM[i];
    mS += minusDM[i];
  }
  const dx: (number | null)[] = new Array(n).fill(null);
  const calcDX = (i: number) => {
    const pdi = trS === 0 ? 0 : (100 * pS) / trS;
    const mdi = trS === 0 ? 0 : (100 * mS) / trS;
    const denom = pdi + mdi;
    dx[i] = denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom;
  };
  calcDX(period);
  for (let i = period + 1; i < n; i++) {
    trS = trS - trS / period + tr[i];
    pS = pS - pS / period + plusDM[i];
    mS = mS - mS / period + minusDM[i];
    calcDX(i);
  }

  // ADX = DX の Wilder 平均（さらに period 本）
  const start = period;
  const firstAdxIdx = start + period;
  if (firstAdxIdx >= n) return out;
  let adxSum = 0;
  for (let i = start; i < firstAdxIdx; i++) adxSum += dx[i] ?? 0;
  let prevAdx = adxSum / period;
  out[firstAdxIdx - 1] = prevAdx;
  for (let i = firstAdxIdx; i < n; i++) {
    prevAdx = (prevAdx * (period - 1) + (dx[i] ?? 0)) / period;
    out[i] = prevAdx;
  }
  return out;
}

function percentileRank(values: number[], x: number): number {
  if (values.length === 0) return 0.5;
  const below = values.filter((v) => v <= x).length;
  return below / values.length;
}

export interface RegimeState {
  regime: Regime;
  adx: number | null;
  trendMaPeriod: number;
  priceVsMa: number | null; // 終値/EMA - 1
  normAtr: number | null; // ATR/終値
  atrPercentile: number | null; // 直近window内の分位(0..1)
}

/**
 * 最新バーのレジームを分類。ADX>25=トレンド, <20=レンジ, 中間=遷移。
 * ヒステリシス簡易版: 直近2本が同条件のときのみトレンド/レンジ確定、揺れは遷移扱い。
 */
export function classifyRegime(candles: Candle[]): RegimeState {
  const n = candles.length;
  const i = n - 1;
  const closes = candles.map((c) => c.close);
  const maPeriod = n >= 200 ? 200 : Math.max(20, Math.floor(n / 2));
  const maArr = ema(closes, maPeriod);
  const adxArr = adx(candles, 14);
  const atrArr = atr(candles, 14);

  const adxNow = adxArr[i];
  const ma = maArr[i];
  const price = closes[i];
  const atrNow = atrArr[i];
  const normAtr = atrNow != null && price > 0 ? atrNow / price : null;

  // 正規化ATRの分位（直近90本）
  let atrPct: number | null = null;
  if (atrNow != null) {
    const window: number[] = [];
    for (let j = Math.max(0, i - 89); j <= i; j++) {
      const a = atrArr[j];
      if (a != null && candles[j].close > 0) window.push(a / candles[j].close);
    }
    if (normAtr != null && window.length > 5) atrPct = percentileRank(window, normAtr);
  }

  const priceVsMa = ma != null ? price / ma - 1 : null;

  const classifyAt = (idx: number): Regime => {
    const a = adxArr[idx];
    const m = maArr[idx];
    if (a == null || m == null) return "unknown";
    if (a > 25) return candles[idx].close > m ? "strong_up" : "strong_down";
    if (a < 20) return "range";
    return "transition";
  };

  let regime = classifyAt(i);
  // ヒステリシス: トレンド/レンジは直近2本一致で確定、不一致は遷移
  if (i >= 1 && (regime === "strong_up" || regime === "strong_down" || regime === "range")) {
    if (classifyAt(i - 1) !== regime) regime = "transition";
  }

  return {
    regime,
    adx: adxNow,
    trendMaPeriod: maPeriod,
    priceVsMa,
    normAtr,
    atrPercentile: atrPct,
  };
}
