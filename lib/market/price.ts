/**
 * 市場価格の取得（サーバーサイド専用・APIキー不要・無料）。
 *
 * ⚠️ Binance の取引API (api.binance.com) は一部地域からアクセス制限があるため、
 * ここでは以下の冗長構成をとる:
 *   1) 主: Binance の公開マーケットデータ用ドメイン data-api.binance.vision
 *      （地域制限が緩く、スキーマは取引APIと同一）
 *   2) フォールバック: CoinGecko (api.coingecko.com)
 *
 * クライアントからは /api/price 経由で叩く（CORS/レート制限/フォールバックをサーバーで吸収）。
 */

const BINANCE_BASE = process.env.PRICE_API_BASE || "https://data-api.binance.vision";
const COINGECKO_BASE = "https://api.coingecko.com";

export interface TickerPrice {
  symbol: string;
  price: number;
  /** 24h 変化率 (%) */
  changePercent: number;
  at: string;
  source: "binance" | "coingecko";
}

export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

/** シンボル → CoinGecko の coin id マップ（フォールバック用） */
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
};

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Provider 1: Binance public market data (data-api.binance.vision)
// ---------------------------------------------------------------------------
async function fetchFromBinance(symbols: readonly string[]): Promise<TickerPrice[]> {
  const query = `["${symbols.join('","')}"]`;
  const url = `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(query)}`;
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const data = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string }[];
  return data.map((d) => ({
    symbol: d.symbol,
    price: Number(d.lastPrice),
    changePercent: Number(d.priceChangePercent),
    at: nowIso(),
    source: "binance" as const,
  }));
}

// ---------------------------------------------------------------------------
// Provider 2: CoinGecko (fallback)
// ---------------------------------------------------------------------------
async function fetchFromCoinGecko(symbols: readonly string[]): Promise<TickerPrice[]> {
  const ids = symbols
    .map((s) => SYMBOL_TO_COINGECKO[s])
    .filter(Boolean);
  if (ids.length === 0) throw new Error("coingecko: no mapped ids");

  const url = `${COINGECKO_BASE}/api/v3/simple/price?ids=${ids.join(
    ","
  )}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const data = (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>;

  const result: TickerPrice[] = [];
  for (const symbol of symbols) {
    const id = SYMBOL_TO_COINGECKO[symbol];
    const entry = id ? data[id] : undefined;
    if (entry) {
      result.push({
        symbol,
        price: entry.usd,
        changePercent: entry.usd_24h_change ?? 0,
        at: nowIso(),
        source: "coingecko",
      });
    }
  }
  return result;
}

/**
 * 複数シンボルの価格を取得する。Binance-vision を主とし、失敗/空なら CoinGecko にフォールバック。
 */
export async function fetchTickers(symbols: readonly string[]): Promise<TickerPrice[]> {
  try {
    const binance = await fetchFromBinance(symbols);
    if (binance.length > 0) return binance;
  } catch {
    // フォールバックへ
  }
  return fetchFromCoinGecko(symbols);
}

/** 単一シンボルの価格を取得（内部で fetchTickers を利用） */
export async function fetchTicker(symbol: string): Promise<TickerPrice> {
  const [ticker] = await fetchTickers([symbol]);
  if (!ticker) throw new Error(`price not available for ${symbol}`);
  return ticker;
}
