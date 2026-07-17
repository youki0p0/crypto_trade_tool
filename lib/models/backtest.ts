/**
 * バックテストエンジン（純粋関数）。
 * 単一ポジション戦略(single)とDCA(dca)の両方をサポートし、共通の成績指標を返す。
 */
import type { Candle, ModelDef } from "./types";
import { computePnL } from "@/lib/trade/pnl";

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  side: "long" | "short";
  entry: number;
  exit: number;
  pnl: number;
  reason: "signal" | "stop" | "take_profit" | "end";
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestMetrics {
  modelId: string;
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRate: number;
  numTrades: number;
  /** 総利益 / 総損失（>1で優位） */
  profitFactor: number;
  /** 原資産をただ買い持ちした場合のリターン（比較用ベンチマーク） */
  buyHoldReturnPct: number;
}

export interface BacktestResult extends BacktestMetrics {
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
}

interface OpenPos {
  side: "long" | "short";
  entry: number;
  entryTime: number;
  quantity: number;
  stopPrice: number | null;
  tpPrice: number | null;
}

function maxDrawdown(curve: EquityPoint[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = (peak - p.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

function finalize(
  modelId: string,
  initialCapital: number,
  equity: number,
  curve: EquityPoint[],
  trades: BacktestTrade[],
  candles: Candle[]
): BacktestResult {
  const wins = trades.filter((t) => t.pnl > 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = trades.filter((t) => t.pnl < 0).reduce((s, t) => s - t.pnl, 0);
  const first = candles[0]?.close ?? 0;
  const last = candles[candles.length - 1]?.close ?? 0;
  return {
    modelId,
    initialCapital,
    finalEquity: equity,
    totalReturnPct: initialCapital > 0 ? (equity - initialCapital) / initialCapital : 0,
    maxDrawdownPct: maxDrawdown(curve),
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    numTrades: trades.length,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    buyHoldReturnPct: first > 0 ? (last - first) / first : 0,
    equityCurve: curve,
    trades,
  };
}

export function runBacktest(
  model: ModelDef,
  candles: Candle[],
  initialCapital = 10000
): BacktestResult {
  if (model.kind === "dca") return runDca(model, candles, initialCapital);

  const ind = model.prepare(candles);
  const decide = model.decide!;
  const { leverage, positionPct, stopLossPct, takeProfitPct, allowShort } = model.params;

  let equity = initialCapital;
  let pos: OpenPos | null = null;
  const trades: BacktestTrade[] = [];
  const curve: EquityPoint[] = [];

  // 純粋な補助関数（クロージャで pos を破壊的変更しない → TS の制御フロー解析が安定）
  const makePos = (side: "long" | "short", price: number, time: number): OpenPos => ({
    side,
    entry: price,
    entryTime: time,
    quantity: price > 0 ? (positionPct * equity * leverage) / price : 0,
    stopPrice:
      stopLossPct == null
        ? null
        : side === "long"
          ? price * (1 - stopLossPct)
          : price * (1 + stopLossPct),
    tpPrice:
      takeProfitPct == null
        ? null
        : side === "long"
          ? price * (1 + takeProfitPct)
          : price * (1 - takeProfitPct),
  });

  const realize = (p: OpenPos, price: number, time: number, reason: BacktestTrade["reason"]) => {
    const pnl = computePnL(
      { side: p.side, entryPrice: p.entry, quantity: p.quantity, leverage },
      price
    );
    equity += pnl;
    trades.push({
      entryTime: p.entryTime,
      exitTime: time,
      side: p.side,
      entry: p.entry,
      exit: price,
      pnl,
      reason,
    });
  };

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // 1) 保有中: 足内で損切り/利確を判定（保守的に損切り優先）
    if (pos) {
      let exitPrice: number | null = null;
      let reason: BacktestTrade["reason"] = "stop";
      if (pos.side === "long") {
        if (pos.stopPrice != null && c.low <= pos.stopPrice) { exitPrice = pos.stopPrice; reason = "stop"; }
        else if (pos.tpPrice != null && c.high >= pos.tpPrice) { exitPrice = pos.tpPrice; reason = "take_profit"; }
      } else {
        if (pos.stopPrice != null && c.high >= pos.stopPrice) { exitPrice = pos.stopPrice; reason = "stop"; }
        else if (pos.tpPrice != null && c.low <= pos.tpPrice) { exitPrice = pos.tpPrice; reason = "take_profit"; }
      }
      if (exitPrice != null) {
        realize(pos, exitPrice, c.time, reason);
        pos = null;
      }
    }

    // 2) シグナル判定（intrabar 決済後の状態で判断）
    const side = pos ? pos.side : null;
    const action = decide(i, candles, ind, side);

    if (action === "exit" && pos) {
      realize(pos, c.close, c.time, "signal");
      pos = null;
    } else if (action === "enter_long") {
      if (pos && pos.side === "short") { realize(pos, c.close, c.time, "signal"); pos = null; }
      if (!pos) pos = makePos("long", c.close, c.time);
    } else if (action === "enter_short" && allowShort) {
      if (pos && pos.side === "long") { realize(pos, c.close, c.time, "signal"); pos = null; }
      if (!pos) pos = makePos("short", c.close, c.time);
    }

    // 3) 時価評価してエクイティ曲線に記録
    let markEquity = equity;
    if (pos) {
      markEquity += computePnL(
        { side: pos.side, entryPrice: pos.entry, quantity: pos.quantity, leverage },
        c.close
      );
    }
    curve.push({ time: c.time, equity: markEquity });
  }

  // 末尾でクローズ
  if (pos && candles.length > 0) {
    const lc = candles[candles.length - 1];
    realize(pos, lc.close, lc.time, "end");
    pos = null;
    curve[curve.length - 1] = { time: lc.time, equity };
  }

  return finalize(model.id, initialCapital, equity, curve, trades, candles);
}

/**
 * DCA: dcaEveryN 本ごとに初期資金の positionPct 相当を現物ロングで買い増し、最後まで保有。
 */
function runDca(model: ModelDef, candles: Candle[], initialCapital: number): BacktestResult {
  const everyN = model.dcaEveryN ?? 7;
  const spendPerBuy = initialCapital * model.params.positionPct;

  let cash = initialCapital;
  let qty = 0;
  let totalCost = 0;
  const curve: EquityPoint[] = [];
  const trades: BacktestTrade[] = [];
  let firstBuyTime = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i % everyN === 0 && cash > 0) {
      const spend = Math.min(spendPerBuy, cash);
      if (spend > 0 && c.close > 0) {
        const bought = spend / c.close;
        qty += bought;
        cash -= spend;
        totalCost += spend;
        if (firstBuyTime === 0) firstBuyTime = c.time;
      }
    }
    const equity = cash + qty * c.close;
    curve.push({ time: c.time, equity });
  }

  // 末尾で全決済（成績集計用に1トレードとして記録）
  const last = candles[candles.length - 1];
  const finalValue = qty * (last?.close ?? 0);
  const pnl = finalValue - totalCost;
  const finalEquity = cash + finalValue;
  if (qty > 0 && last) {
    trades.push({
      entryTime: firstBuyTime,
      exitTime: last.time,
      side: "long",
      entry: totalCost / qty, // 平均取得単価
      exit: last.close,
      pnl,
      reason: "end",
    });
  }

  return finalize(model.id, initialCapital, finalEquity, curve, trades, candles);
}
