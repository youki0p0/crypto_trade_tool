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
  /** レバレッジ倍率 */
  leverage: number;
  /** 1トレードで投入する証拠金の割合（現在 equity に対する 0..1） */
  positionPct: number;
  /** 損切り幅（エントリー価格に対する変動率 0..1）。null なら損切りなし */
  stopLossPct: number | null;
  /** 利確幅（同上）。null なら利確なし */
  takeProfitPct: number | null;
  /** ショートを許可するか */
  allowShort: boolean;
}

export type IndicatorMap = Record<string, (number | null)[]>;

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
  kind: "single" | "dca";
  params: ModelParams;
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
