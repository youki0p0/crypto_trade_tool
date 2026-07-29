/** バックテスト用のローソク足 */
export interface Candle {
  time: number; // epoch ms（足の開始時刻）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type RiskTier = "low" | "mid_low" | "mid" | "mid_high" | "high";

export const RISK_LABEL: Record<RiskTier, string> = {
  low: "低",
  mid_low: "中低",
  mid: "中",
  mid_high: "中高",
  high: "高",
};

export type Action = "enter_long" | "enter_short" | "exit" | "hold";

export interface ModelParams {
  /** 1トレードで許容する損失（現在 equity に対する割合 0..1）。ATRストップ幅から枚数を逆算 */
  riskPerTrade: number;
  /** ストップ幅 = atrStopMult × ATR(14)。ボラに応じて損切り幅と枚数が伸縮する */
  atrStopMult: number;
  /** 利確をリスク(R = ストップ幅)の何倍に置くか。null なら固定利確なし */
  takeProfitR: number | null;
  /** 実効レバレッジの上限。枚数をこの倍率でキャップ（口座過大露出を防ぐ） */
  maxLeverage: number;
  /** ショートを許可するか */
  allowShort: boolean;
  /** DCA専用: 1回の積立で使う初期資金の割合 */
  dcaSpendPct?: number;
}

export type IndicatorMap = Record<string, (number | null)[]>;

/** 合成モデル(ensemble)の構成要素。資金を weight の比率で各サブ戦略に配分する */
export interface EnsembleComponent {
  model: ModelDef;
  /** 資金配分比率（合計1でなくてもよい。内部で正規化する） */
  weight: number;
  /** この戦略に担わせる役割（UI表示・ドキュメント用） */
  role: string;
}

export interface ModelDef {
  id: string;
  name: string;
  tagline: string;
  /** 手法 */
  method: string;
  /** リスクヘッジ */
  hedge: string;
  /** 期待リターンの大きさ（定性） */
  expectedReturn: string;
  risk: RiskTier;
  kind: "single" | "dca" | "ensemble";
  params: ModelParams;
  /** kind==="ensemble" のときのサブ戦略と資金配分 */
  components?: EnsembleComponent[];
  /** バックテスト開始時に指標を一括計算 */
  prepare: (candles: Candle[]) => IndicatorMap;
  /** 各足での判断（single 用） */
  decide?: (
    i: number,
    candles: Candle[],
    ind: IndicatorMap,
    positionSide: "long" | "short" | null
  ) => Action;
  /** DCA の買付間隔（本数） */
  dcaEveryN?: number;
}
