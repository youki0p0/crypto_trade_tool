import { describe, it, expect } from "vitest";
import { sma, ema, rsi, rollingHigh, rollingLow, roc } from "./indicators";

describe("sma", () => {
  it("period3", () => {
    const r = sma([1, 2, 3, 4, 5], 3);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeNull();
    expect(r[2]).toBe(2);
    expect(r[3]).toBe(3);
    expect(r[4]).toBe(4);
  });
});

describe("ema", () => {
  it("最初は SMA 種、その後平滑化", () => {
    const r = ema([1, 2, 3, 4, 5], 3);
    expect(r[2]).toBe(2); // (1+2+3)/3
    // k=0.5: next = 4*0.5 + 2*0.5 = 3
    expect(r[3]).toBeCloseTo(3, 6);
    expect(r[4]).toBeCloseTo(4, 6);
  });
});

describe("rsi", () => {
  it("一貫上昇は RSI=100 付近", () => {
    const vals = Array.from({ length: 20 }, (_, i) => 100 + i);
    const r = rsi(vals, 14);
    expect(r[19]).toBe(100);
  });
  it("一貫下降は RSI=0 付近", () => {
    const vals = Array.from({ length: 20 }, (_, i) => 100 - i);
    const r = rsi(vals, 14);
    expect(r[19]).toBe(0);
  });
});

describe("rollingHigh/Low (shift=1)", () => {
  it("1本前までの高値/安値", () => {
    const highs = [10, 12, 11, 15, 9];
    const rh = rollingHigh(highs, 2, 1);
    // i=2: 前2本(idx0,1)=max(10,12)=12
    expect(rh[2]).toBe(12);
    // i=3: 前2本(idx1,2)=max(12,11)=12
    expect(rh[3]).toBe(12);
    const lows = [10, 12, 11, 15, 9];
    const rl = rollingLow(lows, 2, 1);
    expect(rl[2]).toBe(10);
  });
});

describe("roc", () => {
  it("period2", () => {
    const r = roc([100, 110, 120, 90], 2);
    expect(r[2]).toBeCloseTo(0.2, 6); // (120-100)/100
    expect(r[3]).toBeCloseTo(-0.1818, 3); // (90-110)/110
  });
});
