/**
 * 仮想ポートフォリオの集計（純粋関数）。
 */
import type { PaperTrade } from "@/types/database";
import { computePnL } from "@/lib/trade/pnl";

export interface PortfolioSummary {
  initialBalance: number;
  /** 実現損益の累計（クローズ済みトレード） */
  realizedPnl: number;
  /** 未実現損益（オープン中ポジション、現在価格ベース） */
  unrealizedPnl: number;
  /** 現金残高 = 初期資金 + 実現損益 */
  cashBalance: number;
  /** 総資産 = 現金残高 + 未実現損益 */
  equity: number;
  openPositions: number;
}

export function summarizePortfolio(
  initialBalance: number,
  trades: PaperTrade[],
  currentPrices: Record<string, number>
): PortfolioSummary {
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let openPositions = 0;

  for (const t of trades) {
    if (t.status === "closed") {
      realizedPnl += t.pnl ?? 0;
    } else {
      openPositions += 1;
      const price = currentPrices[t.symbol];
      if (price != null) {
        unrealizedPnl += computePnL(
          { side: t.side, entryPrice: t.price, quantity: t.quantity, leverage: t.leverage },
          price
        );
      }
    }
  }

  const cashBalance = initialBalance + realizedPnl;
  return {
    initialBalance,
    realizedPnl,
    unrealizedPnl,
    cashBalance,
    equity: cashBalance + unrealizedPnl,
    openPositions,
  };
}

export interface EquityPoint {
  date: string; // ISO
  equity: number;
}

/**
 * クローズ済みトレードの realized pnl を時系列に累積して資産推移を作る。
 */
export function buildEquityCurve(
  initialBalance: number,
  trades: PaperTrade[]
): EquityPoint[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closed_at)
    .sort((a, b) => (a.closed_at! < b.closed_at! ? -1 : 1));

  const points: EquityPoint[] = [];
  let running = initialBalance;
  // 起点
  points.push({ date: closed[0]?.closed_at ?? new Date(0).toISOString(), equity: running });
  for (const t of closed) {
    running += t.pnl ?? 0;
    points.push({ date: t.closed_at!, equity: running });
  }
  return points;
}
