/**
 * LLM（Claude）による各戦略モデルの「現在相場の見立て」。サーバーサイド専用。
 *
 * ⚠️ Human Gate: ANTHROPIC_API_KEY（外部有料・secret）が必要。未設定なら isConfigured()=false。
 * 決定論的なバックテスト（lib/models/backtest）とは別レイヤーで、最新スナップショットに対し
 * 各ペルソナがどう判断するかを自然言語で返す（コスト抑制のため1回の呼び出しで5モデル分）。
 */
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./strategies";
import type { Candle } from "./types";
import { sma, ema, rsi, rollingHigh, rollingLow, roc } from "./indicators";

const MODEL_ID = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AdviceSignal = "long" | "short" | "neutral";

export interface ModelAdvice {
  modelId: string;
  signal: AdviceSignal;
  /** 0..1 の確信度 */
  confidence: number;
  rationale: string;
}

export interface MarketSnapshot {
  symbol: string;
  interval: string;
  price: number;
  changePct: number;
  rsi: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  high20: number | null;
  low20: number | null;
  roc3: number | null;
}

/** 最新ローソク足から指標スナップショットを作る（純粋関数） */
export function buildSnapshot(symbol: string, interval: string, candles: Candle[]): MarketSnapshot {
  const closes = candles.map((c) => c.close);
  const i = candles.length - 1;
  const rsiArr = rsi(closes, 14);
  const emaF = ema(closes, 10);
  const emaS = ema(closes, 30);
  const hi = rollingHigh(candles.map((c) => c.high), 20, 1);
  const lo = rollingLow(candles.map((c) => c.low), 20, 1);
  const rocArr = roc(closes, 3);
  void sma; // (将来用)
  const prevClose = closes[i - 1] ?? closes[i];
  return {
    symbol,
    interval,
    price: closes[i],
    changePct: prevClose ? ((closes[i] - prevClose) / prevClose) * 100 : 0,
    rsi: rsiArr[i],
    emaFast: emaF[i],
    emaSlow: emaS[i],
    high20: hi[i],
    low20: lo[i],
    roc3: rocArr[i] != null ? rocArr[i]! * 100 : null,
  };
}

const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          modelId: { type: "string" },
          signal: { type: "string", enum: ["long", "short", "neutral"] },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["modelId", "signal", "confidence", "rationale"],
      },
    },
  },
  required: ["reads"],
} as const;

const SYSTEM = `あなたは暗号通貨のマーケット状況を中立的に解説するアナリストです。
与えられた市場スナップショットに対し、各トレード戦略「ペルソナ」がその手法・リスク許容度に照らして
今どう判断しそうかを、日本語で簡潔に述べてください。
- signal は long(買い)/short(売り)/neutral(様子見) のいずれか。ペルソナの手法に忠実に。
- confidence は 0〜1。
- rationale は1〜2文、根拠は与えられた指標に基づく。
これは投資助言ではなく、教育目的のシミュレーション解説です。断定を避け、リスクに触れてください。`;

/** 5モデル全ペルソナの見立てを1回のClaude呼び出しで取得 */
export async function getModelAdvice(snap: MarketSnapshot): Promise<ModelAdvice[]> {
  if (!isConfigured()) throw new Error("ANTHROPIC_API_KEY が未設定です");

  const client = new Anthropic();

  const personas = MODELS.map(
    (m) => `- id:${m.id} / ${m.name}（${m.tagline}）手法:${m.method} リスク:${m.risk}`
  ).join("\n");

  const fmt = (n: number | null, d = 2) => (n == null ? "N/A" : n.toFixed(d));
  const prompt = `# 市場スナップショット
銘柄: ${snap.symbol} / 時間足: ${snap.interval}
現在価格: ${snap.price}
直近変化: ${fmt(snap.changePct)}%
RSI(14): ${fmt(snap.rsi)}
EMA短期(10): ${fmt(snap.emaFast)} / EMA長期(30): ${fmt(snap.emaSlow)}（短期>長期なら上昇トレンド寄り）
直近20本の高値: ${fmt(snap.high20)} / 安値: ${fmt(snap.low20)}
ROC(3): ${fmt(snap.roc3)}%（短期モメンタム）

# ペルソナ（この5つそれぞれについて見立てを返す。modelId は必ず id を使う）
${personas}

各ペルソナの signal / confidence / rationale を reads 配列で返してください。`;

  const res = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ADVICE_SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (res.stop_reason === "refusal") {
    throw new Error("モデルが応答を拒否しました");
  }

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("応答テキストがありません");
  }

  const parsed = JSON.parse(textBlock.text) as { reads: ModelAdvice[] };
  // 既知の modelId のみ、signal を正規化
  const known = new Set(MODELS.map((m) => m.id));
  return parsed.reads
    .filter((r) => known.has(r.modelId))
    .map((r) => ({
      modelId: r.modelId,
      signal: (["long", "short", "neutral"] as const).includes(r.signal) ? r.signal : "neutral",
      confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
      rationale: String(r.rationale ?? ""),
    }));
}
