import { NextResponse } from "next/server";
import { fetchKlines, KLINE_INTERVALS, type KlineInterval } from "@/lib/market/klines";
import { TRADABLE_SYMBOLS } from "@/lib/trade/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/klines?symbol=BTCUSDT&interval=1d&limit=300 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = (searchParams.get("interval") || "1d") as KlineInterval;
  const limit = Math.min(1000, Math.max(50, Number(searchParams.get("limit")) || 300));

  if (!(TRADABLE_SYMBOLS as readonly string[]).includes(symbol)) {
    return NextResponse.json({ error: "未対応の銘柄です" }, { status: 400 });
  }
  if (!(KLINE_INTERVALS as readonly string[]).includes(interval)) {
    return NextResponse.json({ error: "未対応の時間足です" }, { status: 400 });
  }

  try {
    const { candles, source } = await fetchKlines(symbol, interval, limit);
    if (candles.length === 0) {
      return NextResponse.json({ error: "データを取得できませんでした" }, { status: 502 });
    }
    return NextResponse.json({ candles, source });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `取得に失敗しました: ${msg}` }, { status: 502 });
  }
}
