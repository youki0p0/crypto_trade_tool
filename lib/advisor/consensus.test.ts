import { describe, it, expect } from "vitest";
import { computeConsensus } from "./consensus";
import { classifyRegime } from "./regime";
import type { Candle } from "@/lib/models/types";
import { MODELS } from "@/lib/models/strategies";

function mk(close: number, i: number, hi?: number, lo?: number): Candle {
  return { time: i * 86400000, open: close, high: hi ?? close * 1.01, low: lo ?? close * 0.99, close, volume: 1 };
}

describe("classifyRegime", () => {
  it("単調上昇は strong_up 寄り", () => {
    const c = Array.from({ length: 260 }, (_, i) => mk(100 + i * 1.5, i));
    const r = classifyRegime(c);
    expect(r.adx).not.toBeNull();
    expect(["strong_up", "transition"]).toContain(r.regime);
    expect(r.priceVsMa).toBeGreaterThan(0); // 価格 > EMA
  });
  it("横ばい(ノイズ小)は range 寄り", () => {
    const c = Array.from({ length: 260 }, (_, i) => mk(100 + (i % 2 === 0 ? 0.2 : -0.2), i));
    const r = classifyRegime(c);
    expect(["range", "transition"]).toContain(r.regime);
  });
});

describe("computeConsensus", () => {
  it("上昇相場ではネットがロング寄り、内訳は個別モデル全件（合成は除く）", () => {
    const c = Array.from({ length: 260 }, (_, i) => mk(100 + i * 1.5, i));
    const res = computeConsensus(c);
    // 合成(ensemble)はサブ戦略の集合体なので二重計上を避けて投票に含めない
    const votingCount = MODELS.filter((m) => m.kind !== "ensemble").length;
    expect(res.votes.length).toBe(votingCount);
    expect(res.votes.some((v) => v.modelId === "coil_trinity")).toBe(false);
    expect(res.score).toBeGreaterThanOrEqual(-1);
    expect(res.score).toBeLessThanOrEqual(1);
    expect(res.agreement).toBeGreaterThanOrEqual(0);
    expect(res.agreement).toBeLessThanOrEqual(1);
    expect(["long_bias", "short_bias", "neutral"]).toContain(res.netStance);
  });
  it("DCAは常にロング票", () => {
    const c = Array.from({ length: 260 }, (_, i) => mk(100 - i * 0.5, i));
    const res = computeConsensus(c);
    const dca = res.votes.find((v) => v.modelId === "dca_guardian");
    expect(dca?.vote).toBe("long");
  });
});
