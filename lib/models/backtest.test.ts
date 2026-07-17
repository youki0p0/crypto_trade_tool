import { describe, it, expect } from "vitest";
import { runBacktest } from "./backtest";
import { MODELS } from "./strategies";
import type { ModelDef, Candle } from "./types";

function candle(time: number, close: number, high?: number, low?: number): Candle {
  return { time, open: close, high: high ?? close, low: low ?? close, close, volume: 1 };
}

describe("runBacktest — エンジン機構", () => {
  it("ロング1回の損益が数量ベースで正しい", () => {
    // i=1でロング、i=3でexit。close: 100,100,110,120
    const testModel: ModelDef = {
      id: "t", name: "t", tagline: "", method: "", hedge: "", expectedReturn: "",
      risk: "mid", kind: "single",
      params: { leverage: 1, positionPct: 1, stopLossPct: null, takeProfitPct: null, allowShort: false },
      prepare: () => ({}),
      decide: (i, _c, _ind, side) => {
        if (i === 1 && side === null) return "enter_long";
        if (i === 3 && side === "long") return "exit";
        return "hold";
      },
    };
    const candles = [100, 100, 110, 120].map((p, i) => candle(i, p));
    const r = runBacktest(testModel, candles, 10000);
    // qty = 10000/100 = 100, exit 120 => pnl (120-100)*100 = 2000
    expect(r.finalEquity).toBe(12000);
    expect(r.totalReturnPct).toBe(0.2);
    expect(r.numTrades).toBe(1);
    expect(r.winRate).toBe(1);
    expect(r.buyHoldReturnPct).toBeCloseTo(0.2, 6); // 100->120
  });

  it("損切りが足内の安値で発動する", () => {
    const testModel: ModelDef = {
      id: "t2", name: "t2", tagline: "", method: "", hedge: "", expectedReturn: "",
      risk: "high", kind: "single",
      params: { leverage: 1, positionPct: 1, stopLossPct: 0.05, takeProfitPct: null, allowShort: false },
      prepare: () => ({}),
      decide: (i, _c, _ind, side) => (i === 0 && side === null ? "enter_long" : "hold"),
    };
    // entry 100 at i0, i1 low=90 (< stop 95) => stop at 95
    const candles = [candle(0, 100), candle(1, 92, 101, 90)];
    const r = runBacktest(testModel, candles, 10000);
    // qty 100, exit 95 => pnl (95-100)*100 = -500
    expect(r.trades[0].reason).toBe("stop");
    expect(r.finalEquity).toBe(9500);
  });
});

describe("MODELS — 5モデルが動く", () => {
  // 単調上昇相場を合成
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
    const r = runBacktest(dca, up, 10000);
    expect(r.totalReturnPct).toBeGreaterThan(0);
  });

  it("上昇相場で順張りTrend-Riderはプラス", () => {
    const tr = MODELS.find((m) => m.id === "trend_rider")!;
    const r = runBacktest(tr, up, 10000);
    expect(r.totalReturnPct).toBeGreaterThan(0);
  });
});

describe("期待値・ペイオフ比・設計R:R", () => {
  it("勝ちと負けから期待値/ペイオフ比が正しく出る", () => {
    // i0でロング、i2でexit(+), i3でロング, i5でexit(-)
    const testModel: ModelDef = {
      id: "e", name: "e", tagline: "", method: "", hedge: "", expectedReturn: "",
      risk: "mid", kind: "single",
      params: { leverage: 1, positionPct: 1, stopLossPct: 0.05, takeProfitPct: 0.15, allowShort: false },
      prepare: () => ({}),
      decide: (i, _c, _ind, side) => {
        if ((i === 0 || i === 3) && side === null) return "enter_long";
        if ((i === 2 || i === 5) && side === "long") return "exit";
        return "hold";
      },
    };
    // 価格: 100,100,110(+10%勝ち), 100,100,96(-4%負け) ※stop(95)/tp(115)に触れない値
    const candles = [100, 100, 110, 100, 100, 96].map((p, i) => ({
      time: i, open: p, high: p, low: p, close: p, volume: 1,
    }));
    const r = runBacktest(testModel, candles, 10000);
    expect(r.numTrades).toBe(2);
    expect(r.winRate).toBe(0.5);
    // 1回目: equity1万→qty100, +10% = +1000 (equity→1.1万)
    // 2回目: equity1.1万→qty110, -4% = -440
    // avgWin=1000, avgLoss=440, payoff=1000/440≈2.273, 期待値=(1000-440)/2=280
    expect(r.avgWin).toBeCloseTo(1000, 4);
    expect(r.avgLoss).toBeCloseTo(440, 4);
    expect(r.payoffRatio).toBeCloseTo(1000 / 440, 4);
    expect(r.expectancy).toBeCloseTo(280, 4);
    // 設計R:R = 0.15/0.05 = 3
    expect(r.plannedRR).toBeCloseTo(3, 6);
  });
});
