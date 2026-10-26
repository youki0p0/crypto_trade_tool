"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchTicker } from "@/lib/market/price";
import { computePnL } from "@/lib/trade/pnl";
import { orderSchema } from "@/lib/trade/schema";
import type { PaperTrade } from "@/types/database";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

/**
 * 新規ポジションを建てる。
 * 成行(market)はサーバー取得の現在価格、指値(limit)は指定価格で即時約定として扱う（デモ簡略化）。
 */
export async function openPosition(raw: unknown): Promise<ActionResult> {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力が不正です" };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };

  // 約定価格の決定（成行はサーバーで現在価格を取得＝クライアントを信用しない）
  let fillPrice: number;
  try {
    if (input.type === "market") {
      const ticker = await fetchTicker(input.symbol);
      fillPrice = ticker.price;
    } else {
      fillPrice = input.limitPrice!;
    }
  } catch {
    return { error: "現在価格を取得できませんでした。しばらくして再試行してください。" };
  }

  if (!Number.isFinite(fillPrice) || fillPrice <= 0) {
    return { error: "約定価格が不正です" };
  }

  const { error } = await supabase.from("paper_trades").insert({
    user_id: user.id,
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    price: fillPrice,
    quantity: input.quantity,
    leverage: input.leverage,
    status: "open",
  });
  if (error) return { error: `注文の保存に失敗しました: ${error.message}` };

  revalidatePath("/trade");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * ポジションを決済する。決済価格はサーバーで現在価格を取得し、実現損益を計算する。
 */
export async function closePosition(tradeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };

  const { data: trade, error: fetchErr } = await supabase
    .from("paper_trades")
    .select("*")
    .eq("id", tradeId)
    .single();
  if (fetchErr || !trade) return { error: "対象ポジションが見つかりません" };

  const t = trade as PaperTrade;
  if (t.status !== "open") return { error: "既に決済済みです" };

  let closePrice: number;
  try {
    const ticker = await fetchTicker(t.symbol);
    closePrice = ticker.price;
  } catch {
    return { error: "現在価格を取得できませんでした" };
  }

  const pnl = computePnL(
    { side: t.side, entryPrice: t.price, quantity: t.quantity, leverage: t.leverage },
    closePrice
  );

  const { error } = await supabase
    .from("paper_trades")
    .update({
      status: "closed",
      pnl,
      closed_at: new Date().toISOString(),
    })
    .eq("id", tradeId);
  if (error) return { error: `決済に失敗しました: ${error.message}` };

  revalidatePath("/trade");
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}
