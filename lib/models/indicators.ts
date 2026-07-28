/**
 * テクニカル指標（純粋関数）。入力は時系列の配列（古い→新しい）。
 * 出力は入力と同じ長さで、計算に満たない区間は null。
 */

/** 単純移動平均 */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** 指数移動平均 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      // 最初のEMAは period 分のSMAで種を作る
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

/** RSI (Wilder) */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** 直近 period 本の最高値（当該足を除く: shift=1 で「1本前まで」の高値） */
export function rollingHigh(highs: number[], period: number, shift = 1): (number | null)[] {
  const out: (number | null)[] = new Array(highs.length).fill(null);
  for (let i = 0; i < highs.length; i++) {
    const end = i - shift;
    const start = end - period + 1;
    if (start < 0) continue;
    let m = -Infinity;
    for (let j = start; j <= end; j++) m = Math.max(m, highs[j]);
    out[i] = m;
  }
  return out;
}

/** 直近 period 本の最安値 */
export function rollingLow(lows: number[], period: number, shift = 1): (number | null)[] {
  const out: (number | null)[] = new Array(lows.length).fill(null);
  for (let i = 0; i < lows.length; i++) {
    const end = i - shift;
    const start = end - period + 1;
    if (start < 0) continue;
    let m = Infinity;
    for (let j = start; j <= end; j++) m = Math.min(m, lows[j]);
    out[i] = m;
  }
  return out;
}

/** 変化率 (Rate of Change): (close - close[n本前]) / close[n本前] */
export function roc(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period; i < values.length; i++) {
    const base = values[i - period];
    if (base !== 0) out[i] = (values[i] - base) / base;
  }
  return out;
}

/**
 * ATR (Average True Range, Wilder). 高値/安値/終値の配列から算出。
 * ボラティリティ（1本あたりの平均的な値幅）の指標。ATRベースのサイジング/損切りに使う。
 */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return out;
  const tr: number[] = new Array(n);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    const pc = closes[i - 1];
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - pc), Math.abs(lows[i] - pc));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}
