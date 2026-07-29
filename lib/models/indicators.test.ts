import { describe, it, expect } from "vitest";
import { squeezeArmed } from "./indicators";

describe("squeezeArmed — スクイーズ(ボラ収縮)ゲート", () => {
  it("ボラが拡大し続ける相場では一度も発火しない", () => {
    const n = 400;
    const hi: number[] = [], lo: number[] = [], cl: number[] = [];
    for (let i = 0; i < n; i++) {
      const w = 0.2 + i * 0.05; // 値幅が単調拡大＝収縮しない
      const c = 100 + (i % 2 ? 0.1 : -0.1);
      cl.push(c); hi.push(c + w); lo.push(c - w);
    }
    const armed = squeezeArmed(hi, lo, cl);
    expect(armed.every((v) => v === 0)).toBe(true);
  });

  it("静穏な区間で発火し、通常ボラに戻ってlookbackを過ぎると閉じる", () => {
    const hi: number[] = [], lo: number[] = [], cl: number[] = [];
    for (let i = 0; i < 400; i++) {
      const calm = i >= 200 && i < 280; // ここだけ極端に静か
      const w = calm ? 0.05 : 2;
      const c = 100 + Math.sin(i / 6) * w;
      cl.push(c); hi.push(c + w); lo.push(c - w);
    }
    const armed = squeezeArmed(hi, lo, cl);
    expect(armed[150]).toBe(0); // 静穏前は閉じている
    expect(armed[240]).toBe(1); // 静穏中は開く
    expect(armed[285]).toBe(1); // 明け直後（lookback=12以内）も開く
    expect(armed[340]).toBe(0); // 十分時間が経てば閉じる
  });
});
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
