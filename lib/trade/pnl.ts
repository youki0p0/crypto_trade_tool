/**
 * デモトレードの損益計算（純粋関数）。
 *
 * 用語:
 * - notional（想定元本） = entryPrice × quantity
 * - margin（必要証拠金） = notional / leverage
 * - ロングは価格上昇で利益、ショートは価格下落で利益。損益はレバレッジ倍されない
 *   （数量ベースの評価損益。ただし証拠金に対するリターン率はレバレッジで拡大する）。
 */

import type { TradeSide } from "@/types/database";

export interface PositionInput {
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  leverage: number;
}

/** 想定元本（USDT） */
export function notional(entryPrice: number, quantity: number): number {
  return entryPrice * quantity;
}

/** 必要証拠金（USDT） */
export function requiredMargin(entryPrice: number, quantity: number, leverage: number): number {
  const lev = Math.max(1, leverage);
  return notional(entryPrice, quantity) / lev;
}

/**
 * 未実現/実現損益（USDT）。
 * ロング: (現在価格 − エントリー) × 数量
 * ショート: (エントリー − 現在価格) × 数量
 */
export function computePnL(pos: PositionInput, currentPrice: number): number {
  const diff =
    pos.side === "long"
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice;
  return diff * pos.quantity;
}

/** 証拠金に対する損益率（レバレッジ効果を反映） */
export function pnlPercent(pos: PositionInput, currentPrice: number): number {
  const margin = requiredMargin(pos.entryPrice, pos.quantity, pos.leverage);
  if (margin <= 0) return 0;
  return computePnL(pos, currentPrice) / margin;
}

/**
 * ロスカット（強制決済）価格の概算。
 * 証拠金を100%失う（損益 = −margin）価格。手数料・維持証拠金率は無視した簡易版。
 * ロング: entry × (1 − 1/leverage)
 * ショート: entry × (1 + 1/leverage)
 */
export function liquidationPrice(pos: PositionInput): number {
  const lev = Math.max(1, pos.leverage);
  const factor = 1 / lev;
  return pos.side === "long"
    ? pos.entryPrice * (1 - factor)
    : pos.entryPrice * (1 + factor);
}
