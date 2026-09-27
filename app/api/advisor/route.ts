import { NextResponse } from "next/server";
import { fetchKlines, type KlineInterval, KLINE_INTERVALS } from "@/lib/market/klines";
import { TRADABLE_SYMBOLS } from "@/lib/trade/schema";
import { computeConsensus } from "@/lib/advisor/consensus";
import { isConfigured } from "@/lib/models/llm";
import { fetchContextBrief } from "@/lib/advisor/context";
import { synthesizeAdvisory } from "@/lib/advisor/synthesize";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/advisor  body: { symbol, interval }
 * 合議シグナル(決定論)は常に返す。ANTHROPIC_API_KEY があれば文脈+統合アドバイスも付与。
 */
export async function POST(request: Request) {
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

  let candles;
  try {
    const r = await fetchKlines(symbol, interval, 300);
    candles = r.candles;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `価格データ取得に失敗: ${msg}` }, { status: 502 });
  }
  if (!candles || candles.length < 60) {
    return NextResponse.json({ error: "データが不足しています" }, { status: 502 });
  }

  // ① 合議（常に・キー不要）
  const consensus = computeConsensus(candles);

  // ②③ 文脈 + 統合（キーがあれば）
  const aiEnabled = isConfigured();
  let advisory = null;
  let context = null;
  let aiError: string | null = null;

  if (aiEnabled) {
    try {
      const brief = await fetchContextBrief(symbol);
      context = brief;
      advisory = await synthesizeAdvisory(symbol, consensus, brief.text);
    } catch (e) {
      aiError = e instanceof Error ? e.message : "AI統合に失敗しました";
    }
  }

  return NextResponse.json({ symbol, interval, consensus, aiEnabled, context, advisory, aiError });
}
