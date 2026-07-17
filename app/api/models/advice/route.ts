import { NextResponse } from "next/server";
import { fetchKlines, type KlineInterval, KLINE_INTERVALS } from "@/lib/market/klines";
import { TRADABLE_SYMBOLS } from "@/lib/trade/schema";
import { isConfigured, buildSnapshot, getModelAdvice } from "@/lib/models/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/models/advice  body: { symbol, interval } */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "AI見立ては未設定です（サーバーに ANTHROPIC_API_KEY が必要）。READMEを参照してください。" },
      { status: 503 }
    );
  }

  let body: { symbol?: string; interval?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const symbol = (body.symbol || "BTCUSDT").toUpperCase();
  const interval = (body.interval || "1d") as KlineInterval;

  if (!(TRADABLE_SYMBOLS as readonly string[]).includes(symbol)) {
    return NextResponse.json({ error: "未対応の銘柄です" }, { status: 400 });
  }
  if (!(KLINE_INTERVALS as readonly string[]).includes(interval)) {
    return NextResponse.json({ error: "未対応の時間足です" }, { status: 400 });
  }

  try {
    const { candles } = await fetchKlines(symbol, interval, 60);
    if (candles.length < 35) {
      return NextResponse.json({ error: "データが不足しています" }, { status: 502 });
    }
    const snapshot = buildSnapshot(symbol, interval, candles);
    const reads = await getModelAdvice(snapshot);
    return NextResponse.json({ snapshot, reads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `AI見立ての取得に失敗しました: ${msg}` }, { status: 502 });
  }
}
