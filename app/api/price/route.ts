import { NextResponse } from "next/server";
import { fetchTickers, DEFAULT_SYMBOLS } from "@/lib/market/price";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/price?symbols=BTCUSDT,ETHUSDT
 * サーバーサイドで市場価格を取得して返す（無料APIをプロキシ）。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [...DEFAULT_SYMBOLS];

  try {
    const tickers = await fetchTickers(symbols);
    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "価格を取得できませんでした" },
        { status: 502 }
      );
    }
    return NextResponse.json({ tickers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { error: `価格取得に失敗しました: ${message}` },
      { status: 502 }
    );
  }
}
