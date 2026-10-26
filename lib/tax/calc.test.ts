import { describe, it, expect } from "vitest";
import {
  incomeTax,
  calculateTax,
  SEPARATE_TAX_RATE,
} from "./calc";

describe("incomeTax（所得税速算表）", () => {
  it("課税所得0以下は0", () => {
    expect(incomeTax(0)).toBe(0);
    expect(incomeTax(-100)).toBe(0);
  });

  it("195万以下は5%", () => {
    expect(incomeTax(1_000_000)).toBe(50_000);
  });

  it("500万は 500万×20% − 42.75万 = 57.25万", () => {
    expect(incomeTax(5_000_000)).toBe(572_500);
  });

  it("最高税率45%帯（5000万）", () => {
    // 5000万×45% − 479.6万 = 2250万 − 479.6万 = 1770.4万
    expect(incomeTax(50_000_000)).toBe(17_704_000);
  });
});

describe("calculateTax — 現行総合課税", () => {
  it("他所得300万 + 暗号資産利益300万の限界差分", () => {
    const r = calculateTax({
      cryptoProfit: 3_000_000,
      otherIncome: 3_000_000,
      mode: "current_progressive",
    });
    // 所得税差分: incomeTax(600万)-incomeTax(300万)=772500-202500=570000
    // 復興: 570000*0.021=11970 / 住民: 300万*0.1=300000
    // 合計 = 881970
    expect(Math.round(r.taxAmount)).toBe(881_970);
    expect(Math.round(r.netProfit)).toBe(2_118_030);
    expect(r.effectiveRate).toBeCloseTo(0.29399, 4);
  });

  it("他所得0でも計算できる", () => {
    const r = calculateTax({
      cryptoProfit: 1_000_000,
      otherIncome: 0,
      mode: "current_progressive",
    });
    // incomeTax(100万)=50000, 復興=1050, 住民=100000 => 151050
    expect(Math.round(r.taxAmount)).toBe(151_050);
  });

  it("利益が0以下なら税額0・手取りはそのまま", () => {
    const r = calculateTax({
      cryptoProfit: -500_000,
      otherIncome: 5_000_000,
      mode: "current_progressive",
    });
    expect(r.taxAmount).toBe(0);
    expect(r.netProfit).toBe(-500_000);
    expect(r.effectiveRate).toBe(0);
  });

  it("高所得帯では実効税率が上がる（限界税率の反映）", () => {
    const low = calculateTax({
      cryptoProfit: 1_000_000,
      otherIncome: 1_000_000,
      mode: "current_progressive",
    });
    const high = calculateTax({
      cryptoProfit: 1_000_000,
      otherIncome: 20_000_000,
      mode: "current_progressive",
    });
    expect(high.effectiveRate).toBeGreaterThan(low.effectiveRate);
  });
});

describe("calculateTax — 2028分離課税", () => {
  it("一律20.315%", () => {
    const r = calculateTax({
      cryptoProfit: 1_000_000,
      otherIncome: 9_999_999,
      mode: "separate_2028",
    });
    expect(r.taxAmount).toBeCloseTo(203_150, 0);
    expect(r.effectiveRate).toBeCloseTo(SEPARATE_TAX_RATE, 6);
    // 他所得に依存しない
    const r2 = calculateTax({
      cryptoProfit: 1_000_000,
      otherIncome: 0,
      mode: "separate_2028",
    });
    expect(r2.taxAmount).toBeCloseTo(r.taxAmount, 6);
  });
});
