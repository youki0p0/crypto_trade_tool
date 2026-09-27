/**
 * 過去のローソク足（OHLCV）取得（サーバーサイド専用）。
 * 主: Binance 公開データAPI（OHLCV完全）／フォールバック: CoinGecko（close のみ→OHLC は close で近似）。
 */
import type { Candle } from "@/lib/models/types";

const BINANCE_BASE = process.env.PRICE_API_BASE || "https://data-api.binance.vision";
const COINGECKO_BASE = "https://api.coingecko.com";

export const KLINE_INTERVALS = ["1h", "4h", "1d"] as const;
export type KlineInterval = (typeof KLINE_INTERVALS)[number];

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
};

const CG_DAYS_BY_INTERVAL: Record<KlineInterval, number> = { "1h": 14, "4h": 90, "1d": 365 };

async function fetchBinanceKlines(
  symbol: string,
  interval: KlineInterval,
  limit: number
): Promise<Candle[]> {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`binance klines ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

async function fetchCoinGeckoKlines(
  symbol: string,
  interval: KlineInterval
): Promise<Candle[]> {
  const id = SYMBOL_TO_COINGECKO[symbol];
  if (!id) throw new Error(`coingecko: unmapped symbol ${symbol}`);
  const days = CG_DAYS_BY_INTERVAL[interval];
  const url = `${COINGECKO_BASE}/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`coingecko klines ${res.status}`);
  const data = (await res.json()) as { prices: [number, number][] };
  // close のみ。OHLC は close で近似（high/low が必要な戦略は精度が落ちる旨をUIで注記）。
  return data.prices.map(([t, p]) => ({
    time: t,
    open: p,
    high: p,
    low: p,
    close: p,
    volume: 0,
  }));
}

export interface KlineResult {
  candles: Candle[];
  source: "binance" | "coingecko";
}

export async function fetchKlines(
  symbol: string,
  interval: KlineInterval,
  limit = 300
): Promise<KlineResult> {
  try {
    const candles = await fetchBinanceKlines(symbol, interval, limit);
    if (candles.length > 0) return { candles, source: "binance" };
  } catch {
    // fallback
  }
  const candles = await fetchCoinGeckoKlines(symbol, interval);
  return { candles: candles.slice(-limit), source: "coingecko" };
}
