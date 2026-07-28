import { describe, it, expect } from "vitest";
import { runBacktest } from "./backtest";
import { MODELS } from "./strategies";
import type { ModelDef, Candle, ModelParams } from "./types";

function candle(time: number, close: number, high?: number, low?: number): Candle {
  return { time, open: close, high: high ?? close, low: low ?? close, close, volume: 1 };
}

function tModel(params: ModelParams, decide: ModelDef["decide"]): ModelDef {
  return {
    id: "t", name: "t", tagline: "", method: "", hedge: "", expectedReturn: "",
    risk: "mid", kind: "single", params, prepare: () => ({}), decide,
  };
}

// ATRが一定(=2)になる合成データ: 値幅2の足を緩やかに上昇（close移動<1でTR=2支配）
const upFlat: Candle[] = Array.from({ length: 30 }, (_, i) => {
  const cl = 100 + i * 0.2;
  return candle(i, cl, cl + 1, cl - 1);
});

describe("ATRベースのサイジング", () => {
  it("枚数は riskPerTrade に比例する（ATR一定なら損益も比例）", () => {
    // i=20でロング(close=104, ATR=2, stop幅=2*2=4)、i=25でexit(close=105)。stopには当たらない
    const dec: ModelDef["decide"] = (i, _c, _ind, side) =>
      i === 20 && side === null ? "enter_long" : i === 25 && side === "long" ? "exit" : "hold";
    const p = (rp: number): ModelParams => ({ riskPerTrade: rp, atrStopMult: 2, takeProfitR: null, maxLeverage: 100, allowShort: false });
    const r1 = runBacktest(tModel(p(0.01), dec), upFlat, 10000);
    const r2 = runBacktest(tModel(p(0.02), dec), upFlat, 10000);
    // qty = 10000*rp/4 → r1:25, r2:50。価格差(105-104)=1 → pnl=qty
    expect(r1.trades[0].pnl).toBeCloseTo(25, 4);
    expect(r2.trades[0].pnl).toBeCloseTo(50, 4);
    expect(r2.trades[0].pnl / r1.trades[0].pnl).toBeCloseTo(2, 6);
  });

  it("ATRベースの損切りが k×ATR の位置で発動する", () => {
    const series: Candle[] = [];
    for (let i = 0; i < 21; i++) series.push(candle(i, 100, 101, 99)); // 平坦, ATR=2
    series.push(candle(21, 96, 100, 95)); // 下ヒゲで急落
    const dec: ModelDef["decide"] = (i, _c, _ind, side) => (i === 20 && side === null ? "enter_long" : "hold");
    const m = tModel({ riskPerTrade: 0.01, atrStopMult: 2, takeProfitR: null, maxLeverage: 100, allowShort: false }, dec);
    const r = runBacktest(m, series, 10000);
    // entry100, ATR=2, stop幅=4 → stop価格96。i=21のlow=95<=96で発動。qty=10000*0.01/4=25 → pnl=(96-100)*25=-100
    expect(r.trades[0].reason).toBe("stop");
    expect(r.trades[0].pnl).toBeCloseTo(-100, 4);
    expect(r.finalEquity).toBeCloseTo(9900, 4);
  });

  it("maxLeverage で枚数がキャップされる", () => {
    const dec: ModelDef["decide"] = (i, _c, _ind, side) =>
      i === 20 && side === null ? "enter_long" : i === 25 && side === "long" ? "exit" : "hold";
    // riskPerTrade=1.0 は過大 → maxLeverage で頭打ち。lev1 vs lev2 で損益が約2倍
    const p = (lev: number): ModelParams => ({ riskPerTrade: 1.0, atrStopMult: 2, takeProfitR: null, maxLeverage: lev, allowShort: false });
    const r1 = runBacktest(tModel(p(1), dec), upFlat, 10000);
    const r2 = runBacktest(tModel(p(2), dec), upFlat, 10000);
    // 実効レバ1: maxQty=1*10000/104≈96.15, pnl=(105-104)*96.15≈96.15
    expect(r1.trades[0].pnl).toBeCloseTo(96.15, 1);
    expect(r2.trades[0].pnl / r1.trades[0].pnl).toBeCloseTo(2, 2);
  });
});

describe("plannedRR = takeProfitR", () => {
  it("takeProfitR がそのまま設計R:Rになる", () => {
    const breakout = MODELS.find((m) => m.id === "breakout_hunter")!;
    const trend = MODELS.find((m) => m.id === "trend_rider")!;
    expect(runBacktest(breakout, upFlat, 10000).plannedRR).toBe(3);
    expect(runBacktest(trend, upFlat, 10000).plannedRR).toBeNull();
  });
});

describe("MODELS — 5モデルが動く", () => {
  const up: Candle[] = Array.from({ length: 120 }, (_, i) => {
    const base = 100 + i * 2;
    return candle(i * 86400000, base, base * 1.01, base * 0.99);
  });

  it("全モデルがエラーなく完走し指標を返す", () => {
    for (const m of MODELS) {
      const r = runBacktest(m, up, 10000);
      expect(r.equityCurve.length).toBe(up.length);
      expect(Number.isFinite(r.totalReturnPct)).toBe(true);
      expect(r.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      expect(r.winRate).toBeGreaterThanOrEqual(0);
      expect(r.winRate).toBeLessThanOrEqual(1);
    }
  });

  it("上昇相場でDCAはプラス", () => {
    const dca = MODELS.find((m) => m.id === "dca_guardian")!;
    expect(runBacktest(dca, up, 10000).totalReturnPct).toBeGreaterThan(0);
  });

  it("上昇相場で順張りTrend-Riderはプラス", () => {
    const tr = MODELS.find((m) => m.id === "trend_rider")!;
    expect(runBacktest(tr, up, 10000).totalReturnPct).toBeGreaterThan(0);
  });
});
