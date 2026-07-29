/**
 * 5つの戦略モデル。手法・リスクヘッジ・リターンの大きさを変えて差別化する。
 * いずれも決定論的なルールベース（バックテスト可能）。
 */
import type { ModelDef, Candle, IndicatorMap, Action } from "./types";
import { sma, ema, rsi, rollingHigh, rollingLow, roc, squeezeArmed } from "./indicators";

const closes = (c: Candle[]) => c.map((x) => x.close);
const highs = (c: Candle[]) => c.map((x) => x.high);
const lows = (c: Candle[]) => c.map((x) => x.low);

// ---------------------------------------------------------------------------
// 1. DCA-Guardian（守り）— ドルコスト平均法
// ---------------------------------------------------------------------------
const dcaGuardian: ModelDef = {
  id: "dca_guardian",
  name: "DCA-Guardian",
  tagline: "守り・積立",
  method: "ドルコスト平均法。一定間隔で一定額を分割購入し取得単価を平準化。現物ロングのみで保有継続。",
  hedge: "レバレッジなし・現物ロングのみ・損切りなし（時間分散でリスクを平準化）。積立額は初期資金の10%/回。",
  expectedReturn: "低・安定（原資産に連動しつつ変動を抑制）",
  risk: "low",
  kind: "dca",
  dcaEveryN: 7,
  params: { riskPerTrade: 0, atrStopMult: 0, takeProfitR: null, maxLeverage: 1, allowShort: false, dcaSpendPct: 0.1 },
  prepare: () => ({}),
};

// ---------------------------------------------------------------------------
// 2. Range-Sniper（押し目）— RSI 逆張り
// ---------------------------------------------------------------------------
const rangeSniper: ModelDef = {
  id: "range_sniper",
  name: "Range-Sniper",
  tagline: "押し目・逆張り",
  method: "レンジ相場でRSIが売られすぎ(<30)のとき押し目買い。RSIが55を超えたら利益確定。",
  hedge: "1トレードの損失を口座の0.75%に固定・損切りはATR×1.5・利確は2R。ボラに応じ枚数を自動調整（実効レバ上限3x）。ロングのみ。",
  expectedReturn: "中低（勝率重視・1回の利幅は小さめ）",
  risk: "mid_low",
  kind: "single",
  params: { riskPerTrade: 0.0075, atrStopMult: 1.5, takeProfitR: 2.0, maxLeverage: 3, allowShort: false },
  prepare: (c) => ({ rsi: rsi(closes(c), 14) }),
  decide: (i, _c, ind, side): Action => {
    const r = ind.rsi[i];
    if (r == null) return "hold";
    if (side === null) return r < 30 ? "enter_long" : "hold";
    return r > 55 ? "exit" : "hold";
  },
};

// ---------------------------------------------------------------------------
// 3. Trend-Rider（順張り）— EMA クロス
// ---------------------------------------------------------------------------
const trendRider: ModelDef = {
  id: "trend_rider",
  name: "Trend-Rider",
  tagline: "順張り・トレンド",
  method: "短期EMA(10)が長期EMA(30)を上抜けでロング、下抜けでドテン（ショート可）。トレンドに乗る。",
  hedge: "1トレード0.75%リスク・損切りはATR×2.5・固定利確なし（トレンドを取りきる）。ドテンで方向転換に追随。実効レバ上限3x。",
  expectedReturn: "中（トレンド相場で伸び、レンジでは往復ビンタに弱い）",
  risk: "mid",
  kind: "single",
  params: { riskPerTrade: 0.0075, atrStopMult: 2.5, takeProfitR: null, maxLeverage: 3, allowShort: true },
  prepare: (c) => ({ fast: ema(closes(c), 10), slow: ema(closes(c), 30) }),
  decide: (i, _c, ind, side): Action => {
    const f = ind.fast[i];
    const s = ind.slow[i];
    if (f == null || s == null) return "hold";
    // 状態ベースのトレンドフォロー: 短期EMA>長期EMAの間はロング側、逆はショート側に「常に乗る」。
    // クロスの瞬間を逃してもトレンド継続中は参入できる（レンジでは往復に弱いのがトレードオフ）。
    const up = f > s;
    if (side === null) return up ? "enter_long" : "enter_short";
    if (side === "long" && !up) return "enter_short"; // ドテン
    if (side === "short" && up) return "enter_long";
    return "hold";
  },
};

// ---------------------------------------------------------------------------
// 4. Breakout-Hunter（ブレイク）— ドンチャン・ブレイクアウト
// ---------------------------------------------------------------------------
const breakoutHunter: ModelDef = {
  id: "breakout_hunter",
  name: "Breakout-Hunter",
  tagline: "ブレイク・ボラ",
  method: "直近20本の高値を上抜けでロング、安値を下抜けでショート。ボラティリティ拡大に乗る。",
  hedge: "1トレード0.75%リスク・損切りはATR×2.0・利確3R（利大損小狙い）。ダマシに備えタイト損切りで即撤退。実効レバ上限3x。",
  expectedReturn: "中高（当たれば大きいがダマシで細かい損失も出やすい）",
  risk: "mid_high",
  kind: "single",
  params: { riskPerTrade: 0.0075, atrStopMult: 2.0, takeProfitR: 3.0, maxLeverage: 3, allowShort: true },
  prepare: (c) => ({
    hi: rollingHigh(highs(c), 20, 1),
    lo: rollingLow(lows(c), 20, 1),
  }),
  decide: (i, c, ind, side): Action => {
    const hi = ind.hi[i];
    const lo = ind.lo[i];
    if (hi == null || lo == null) return "hold";
    const price = c[i].close;
    if (side === null) {
      if (price > hi) return "enter_long";
      if (price < lo) return "enter_short";
      return "hold";
    }
    // 逆方向ブレイクで転換
    if (side === "long" && price < lo) return "enter_short";
    if (side === "short" && price > hi) return "enter_long";
    return "hold";
  },
};

// ---------------------------------------------------------------------------
// 5. Momentum-Blitz（攻め）— 高レバ短期モメンタム
// ---------------------------------------------------------------------------
const momentumBlitz: ModelDef = {
  id: "momentum_blitz",
  name: "Momentum-Blitz",
  tagline: "攻め・モメンタム",
  method: "短期モメンタム(ROC3)が+3%超で順張りロング、-3%割れでショート。高頻度で回転。",
  hedge: "高頻度のため1トレードは0.35%と小さめリスク・損切りはATR×1.2（タイト）・利確1.5R。ボラ拡大時は枚数が自動縮小（実効レバ上限3x）。",
  expectedReturn: "高・高変動（資産曲線の振れが大きい。ドローダウンも大）",
  risk: "high",
  kind: "single",
  params: { riskPerTrade: 0.0035, atrStopMult: 1.2, takeProfitR: 1.5, maxLeverage: 3, allowShort: true },
  prepare: (c) => ({ roc: roc(closes(c), 3), ma: sma(closes(c), 5) }),
  decide: (i, _c, ind, side): Action => {
    const m = ind.roc[i];
    if (m == null) return "hold";
    if (side === null) {
      if (m > 0.03) return "enter_long";
      if (m < -0.03) return "enter_short";
      return "hold";
    }
    if (side === "long" && m < -0.03) return "enter_short";
    if (side === "short" && m > 0.03) return "enter_long";
    return "hold";
  },
};

// ---------------------------------------------------------------------------
// 6. Breakout-Coil（選別ブレイク）— スクイーズ明けのブレイクだけを撃つ
// ---------------------------------------------------------------------------
/** 収縮判定の設定: 正規化ATRが直近1週(168本)の下位30%なら収縮、その後12本以内を発火可能とする */
const COIL_SQUEEZE = { window: 168, pct: 0.3, lookback: 12 } as const;

const breakoutCoil: ModelDef = {
  id: "breakout_coil",
  name: "Breakout-Coil",
  tagline: "選別ブレイク・安定重視",
  method:
    "Breakout-Hunterと同じドンチャン20本ブレイクだが、「ボラ収縮(スクイーズ)明け」でのみ新規建てする。" +
    "正規化ATRが直近168本の下位30%に入った後12本以内のブレイクだけを本物とみなし、平常時のブレイクは見送る。",
  hedge:
    "ダマシの多い平常時ブレイクを構造的に回避し取引数を約4割削減。1トレード0.75%リスク・損切りATR×2.0・利確3R・実効レバ上限3x。" +
    "「撃つ場所を選ぶ」ことでピーク益より相場をまたいだ安定を優先する。",
  expectedReturn: "中（単年の最大益は抑えめだが、相場が変わっても崩れにくい）",
  risk: "mid",
  kind: "single",
  params: { riskPerTrade: 0.0075, atrStopMult: 2.0, takeProfitR: 3.0, maxLeverage: 3, allowShort: true },
  prepare: (c) => ({
    hi: rollingHigh(highs(c), 20, 1),
    lo: rollingLow(lows(c), 20, 1),
    armed: squeezeArmed(highs(c), lows(c), closes(c), COIL_SQUEEZE),
  }),
  decide: (i, c, ind, side): Action => {
    const hi = ind.hi[i];
    const lo = ind.lo[i];
    if (hi == null || lo == null) return "hold";
    const price = c[i].close;
    // ゲート: 収縮明けでなければ新規建て・ドテンともに見送る（保有中の決済はエンジンの損切り/利確に任せる）
    const armed = ind.armed[i] === 1;
    if (!armed) return "hold";
    if (side === null) {
      if (price > hi) return "enter_long";
      if (price < lo) return "enter_short";
      return "hold";
    }
    if (side === "long" && price < lo) return "enter_short";
    if (side === "short" && price > hi) return "enter_long";
    return "hold";
  },
};

// ---------------------------------------------------------------------------
// 7. Coil-Trinity（合成）— 選別ブレイク＋素の安定＋トレンド分散の三本柱
// ---------------------------------------------------------------------------
/**
 * 検証で分かった「戦略ごとに安定化の手段が違う」という知見をそのまま構成に落とした合成エージェント。
 * - Breakout-Coil: 弱点(ダマシ)を選別で潰せる → 主軸
 * - Momentum-Blitz: 元から年ブレが極小 → 主軸
 * - Trend-Rider: 平均リターンは高いがトレンドの有無に依存 → 分散要員（配分は小さめ）
 * 資金をスリーブに分け各戦略が独立に売買する。合計の実効レバは各スリーブ上限の加重和に収まる。
 */
const coilTrinity: ModelDef = {
  id: "coil_trinity",
  name: "Coil-Trinity",
  tagline: "合成・三本柱",
  method:
    "資金を3つのスリーブに分割し、Breakout-Coil(40%)・Momentum-Blitz(35%)・Trend-Rider(25%)を並行運用する合成エージェント。" +
    "各戦略は自分のスリーブ内で独立にサイジング・損切りを行う。",
  hedge:
    "「安定化の手段は戦略ごとに違う」という検証結果に基づく役割分担。選別で安定させたブレイクと元から安定なモメンタムを主軸に置き、" +
    "地合い依存の強いトレンド戦略は上げ相場の取りこぼしを防ぐ分散要員として小さく配分。単一戦略の当たり外れに賭けない構成。",
  expectedReturn: "中（単年の最大益は狙わず、下げ相場でも上げ相場でもプラス圏を目指す）",
  risk: "mid",
  kind: "ensemble",
  params: { riskPerTrade: 0, atrStopMult: 0, takeProfitR: null, maxLeverage: 3, allowShort: true },
  components: [
    { model: breakoutCoil, weight: 0.4, role: "主軸: 選別ブレイク（ダマシを避けて安定）" },
    { model: momentumBlitz, weight: 0.35, role: "主軸: 素の安定（年ブレが極小）" },
    { model: trendRider, weight: 0.25, role: "分散: トレンド相場の取りこぼし防止" },
  ],
  prepare: () => ({}),
};

export const MODELS: ModelDef[] = [
  dcaGuardian,
  rangeSniper,
  trendRider,
  breakoutHunter,
  momentumBlitz,
  breakoutCoil,
  coilTrinity,
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}
