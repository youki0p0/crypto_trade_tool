import { describe, it, expect } from "vitest";
import { computePnL, requiredMargin, liquidationPrice, pnlPercent } from "./pnl";

describe("computePnL", () => {
  it("ロング利益: (110-100)*2 = 20", () => {
    expect(computePnL({ side: "long", entryPrice: 100, quantity: 2, leverage: 5 }, 110)).toBe(20);
  });
  it("ショート利益: (100-90)*2 = 20", () => {
    expect(computePnL({ side: "short", entryPrice: 100, quantity: 2, leverage: 5 }, 90)).toBe(20);
  });
  it("ロング損失: (90-100)*1 = -10", () => {
    expect(computePnL({ side: "long", entryPrice: 100, quantity: 1, leverage: 1 }, 90)).toBe(-10);
  });
});

describe("requiredMargin", () => {
  it("notional/leverage: 100*2/10 = 20", () => {
    expect(requiredMargin(100, 2, 10)).toBe(20);
  });
});

describe("pnlPercent（レバレッジ効果）", () => {
  it("10x で 1% の価格変動が証拠金比 ~10%", () => {
    const p = pnlPercent({ side: "long", entryPrice: 100, quantity: 1, leverage: 10 }, 101);
    expect(p).toBeCloseTo(0.1, 6);
  });
});

describe("liquidationPrice", () => {
  it("ロング 10x: 100*(1-0.1)=90", () => {
    expect(liquidationPrice({ side: "long", entryPrice: 100, quantity: 1, leverage: 10 })).toBe(90);
  });
  it("ショート 10x: 100*(1+0.1)=110", () => {
    expect(liquidationPrice({ side: "short", entryPrice: 100, quantity: 1, leverage: 10 })).toBeCloseTo(110, 6);
  });
});
