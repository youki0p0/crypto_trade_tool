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

describe("Breakout-Coil — スクイーズ・ゲート", () => {
  it("収縮が一度も起きない相場では新規建てしない（ゲートが閉じ続ける）", () => {
    // 値幅が単調拡大＝収縮なし。ゲートが開かないので何があっても建てない
    const expanding: Candle[] = Array.from({ length: 400 }, (_, i) => {
      const w = 0.2 + i * 0.05;
      const cl = 100 + (i % 2 ? 0.1 : -0.1);
      return candle(i, cl, cl + w, cl - w);
    });
    const coil = MODELS.find((m) => m.id === "breakout_coil")!;
    expect(runBacktest(coil, expanding, 10000).numTrades).toBe(0);
  });

  it("取引数はゲート無しのBreakout以下になる（選別なので増えることはない）", () => {
    // 収縮→拡大を繰り返す合成データ
    const mixed: Candle[] = Array.from({ length: 400 }, (_, i) => {
      const cl = 100 + i * 0.3 + Math.sin(i / 7) * 3;
      const w = i % 120 < 60 ? 0.4 : 4; // 前半=収縮, 後半=拡大
      return candle(i, cl, cl + w, cl - w);
    });
    const coil = MODELS.find((m) => m.id === "breakout_coil")!;
    const hunter = MODELS.find((m) => m.id === "breakout_hunter")!;
    expect(runBacktest(coil, mixed, 10000).numTrades).toBeLessThanOrEqual(
      runBacktest(hunter, mixed, 10000).numTrades
    );
  });
});

describe("Coil-Trinity — 合成(ensemble)", () => {
  const up: Candle[] = Array.from({ length: 300 }, (_, i) => {
    const base = 100 + i * 0.8 + Math.sin(i / 9) * 4;
    const w = i % 100 < 50 ? 0.5 : 3;
    return candle(i, base, base + w, base - w);
  });

  it("資金はスリーブに分割され、合成エクイティは各スリーブの合算になる", () => {
    const tri = MODELS.find((m) => m.id === "coil_trinity")!;
    const r = runBacktest(tri, up, 10000);
    const comps = tri.components!;
    const totalW = comps.reduce((s, c) => s + c.weight, 0);
    const sleeveSum = comps.reduce(
      (s, c) => s + runBacktest(c.model, up, 10000 * (c.weight / totalW)).finalEquity,
      0
    );
    expect(r.finalEquity).toBeCloseTo(sleeveSum, 6);
    expect(r.equityCurve.length).toBe(up.length);
    // 開始時の合成エクイティは元本と一致（スリーブ合計＝初期資金）
    expect(r.equityCurve[0].equity).toBeCloseTo(10000, 4);
  });

  it("構成は3戦略・重み合計1・合成の設計R:Rはnull", () => {
    const tri = MODELS.find((m) => m.id === "coil_trinity")!;
    expect(tri.kind).toBe("ensemble");
    expect(tri.components).toHaveLength(3);
    expect(tri.components!.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 6);
    // 主軸2つ（選別ブレイク・モメンタム）が過半、トレンドは分散要員で最小
    const byId = Object.fromEntries(tri.components!.map((c) => [c.model.id, c.weight]));
    expect(byId["breakout_coil"] + byId["momentum_blitz"]).toBeGreaterThan(0.5);
    expect(byId["trend_rider"]).toBeLessThan(byId["breakout_coil"]);
    expect(runBacktest(tri, up, 10000).plannedRR).toBeNull();
  });

  it("トレードは全スリーブ分が決済時刻順に集約される", () => {
    const tri = MODELS.find((m) => m.id === "coil_trinity")!;
    const r = runBacktest(tri, up, 10000);
    for (let i = 1; i < r.trades.length; i++) {
      expect(r.trades[i].exitTime).toBeGreaterThanOrEqual(r.trades[i - 1].exitTime);
    }
  });
});

describe("MODELS — 全モデルが動く", () => {
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
