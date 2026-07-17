/**
 * 合議エンジン（純粋関数・キー不要）。アドバイザーの「背骨」。
 * 5モデルの最新バーでのシグナルを、レジームに応じた重みで合議し、
 * ネットスタンス・一致度・モデル別内訳を返す。予測ではなく「エッジの多数決」。
 */
import type { Candle, IndicatorMap } from "@/lib/models/types";
import { MODELS } from "@/lib/models/strategies";
import { classifyRegime, type Regime, type RegimeState } from "./regime";

export type Vote = "long" | "short" | "neutral";

export interface ModelVote {
  modelId: string;
  name: string;
  tagline: string;
  vote: Vote;
  weight: number; // レジーム重み（正規化前）
  active: boolean; // そのレジームで稼働するか
}

export type NetStance = "long_bias" | "short_bias" | "neutral";

export interface ConsensusResult {
  regime: RegimeState;
  votes: ModelVote[];
  /** -1(総ショート) 〜 +1(総ロング) の加重スコア */
  score: number;
  netStance: NetStance;
  /** 稼働モデルのうち多数派方向に一致する重み比率 0..1 */
  agreement: number;
}

/**
 * 会議裁定のレジーム別重み（乗数）。基礎は等重み1.0。
 * transition/unknown は全モデル×0.5の縮退モード。
 */
const REGIME_WEIGHTS: Record<Regime, Record<string, number>> = {
  strong_up:   { dca_guardian: 1.0,  range_sniper: 0.7,  trend_rider: 1.3, breakout_hunter: 1.3,  momentum_blitz: 1.15 },
  strong_down: { dca_guardian: 0.7,  range_sniper: 0.85, trend_rider: 1.3, breakout_hunter: 1.3,  momentum_blitz: 1.0 },
  range:       { dca_guardian: 1.15, range_sniper: 1.3,  trend_rider: 0.7, breakout_hunter: 0.7,  momentum_blitz: 0.7 },
  transition:  { dca_guardian: 0.5,  range_sniper: 0.5,  trend_rider: 0.5, breakout_hunter: 0.5,  momentum_blitz: 0.5 },
  unknown:     { dca_guardian: 0.5,  range_sniper: 0.5,  trend_rider: 0.5, breakout_hunter: 0.5,  momentum_blitz: 0.5 },
};

/** そのモデルがそのレジームで「稼働」するか（重み<0.75なら縮小=非主役だが投票は残す） */
function isActive(modelId: string, regime: Regime): boolean {
  // レンジではトレンド/ブレイク/モメンタムは非稼働寄り、トレンドではRangeが非稼働寄り
  const w = REGIME_WEIGHTS[regime][modelId] ?? 0.5;
  return w >= 0.7;
}

/** 各モデルの最新バーでのシグナルを取得（フラット状態でどう動くか） */
function modelVote(candles: Candle[]): Map<string, Vote> {
  const i = candles.length - 1;
  const out = new Map<string, Vote>();
  for (const m of MODELS) {
    if (m.kind === "dca") {
      // DCAは常に「積立＝弱いロング」
      out.set(m.id, "long");
      continue;
    }
    const ind: IndicatorMap = m.prepare(candles);
    const action = m.decide ? m.decide(i, candles, ind, null) : "hold";
    out.set(m.id, action === "enter_long" ? "long" : action === "enter_short" ? "short" : "neutral");
  }
  return out;
}

export function computeConsensus(candles: Candle[]): ConsensusResult {
  const regimeState = classifyRegime(candles);
  const regime = regimeState.regime;
  const votes = modelVote(candles);

  const modelVotes: ModelVote[] = MODELS.map((m) => {
    const weight = REGIME_WEIGHTS[regime][m.id] ?? 0.5;
    return {
      modelId: m.id,
      name: m.name,
      tagline: m.tagline,
      vote: votes.get(m.id) ?? "neutral",
      weight,
      active: isActive(m.id, regime),
    };
  });

  // 加重スコア: long=+1, short=-1, neutral=0
  let weighted = 0;
  let totalWeight = 0;
  for (const mv of modelVotes) {
    const dir = mv.vote === "long" ? 1 : mv.vote === "short" ? -1 : 0;
    weighted += dir * mv.weight;
    totalWeight += mv.weight;
  }
  const score = totalWeight > 0 ? weighted / totalWeight : 0;
  const netStance: NetStance = score > 0.15 ? "long_bias" : score < -0.15 ? "short_bias" : "neutral";

  // 一致度: 多数派方向に一致する非中立モデルの重み比率
  const dirSign = score > 0 ? 1 : score < 0 ? -1 : 0;
  let agreeW = 0;
  let nonNeutralW = 0;
  for (const mv of modelVotes) {
    const dir = mv.vote === "long" ? 1 : mv.vote === "short" ? -1 : 0;
    if (dir !== 0) {
      nonNeutralW += mv.weight;
      if (dir === dirSign) agreeW += mv.weight;
    }
  }
  const agreement = nonNeutralW > 0 ? agreeW / nonNeutralW : 0;

  return { regime: regimeState, votes: modelVotes, score, netStance, agreement };
}
