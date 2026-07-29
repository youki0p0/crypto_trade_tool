/**
 * 統合層（Claude 構造化出力・サーバー専用・要ANTHROPIC_API_KEY）。
 * ①合議(決定論) と ②文脈(ニュース/SNS) を融合し、構造化された売買アドバイスを返す。
 * 予測の断定ではなく「エッジの合議＋文脈＋リスク管理」を提示する。
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ConsensusResult } from "./consensus";
import { REGIME_LABEL } from "./regime";

const MODEL_ID = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export type AdviceStance =
  | "strong_long"
  | "long_bias"
  | "neutral"
  | "short_bias"
  | "strong_short"
  | "avoid";

export interface Advisory {
  stance: AdviceStance;
  confidence: number;
  horizon: "short" | "medium";
  summary: string;
  keyDrivers: string[];
  keyRisks: string[];
  invalidation: string;
  riskNote: string;
  sources: { title: string; url: string }[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stance: { type: "string", enum: ["strong_long", "long_bias", "neutral", "short_bias", "strong_short", "avoid"] },
    confidence: { type: "number" },
    horizon: { type: "string", enum: ["short", "medium"] },
    summary: { type: "string" },
    keyDrivers: { type: "array", items: { type: "string" } },
    keyRisks: { type: "array", items: { type: "string" } },
    invalidation: { type: "string" },
    riskNote: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, url: { type: "string" } },
        required: ["title", "url"],
      },
    },
  },
  required: ["stance", "confidence", "horizon", "summary", "keyDrivers", "keyRisks", "invalidation", "riskNote", "sources"],
} as const;

const SYSTEM = `あなたは規律あるポートフォリオ・アドバイザー。予測の的中ではなく「複数エッジの合議＋文脈＋リスク管理」で判断する。
原則:
- 決定論的な合議シグナル(モデル群の多数決)を背骨とし、ニュース/SNSセンチメントは確信度を上下させる補助・拒否権として扱う(主役にしない)。SNSは操作されやすい遅行指標。
- 裸の「今すぐ買え/売れ」を出さない。必ず根拠・リスク・"この前提が崩れたら無効"を添える。
- レバレッジのロスカットや最大ドローダウンのリスクに言及する。
- これは教育/シミュレーション用途であり投資助言ではない。断定を避ける。`;

export async function synthesizeAdvisory(
  symbol: string,
  consensus: ConsensusResult,
  contextText: string
): Promise<Advisory> {
  const client = new Anthropic();

  const votesText = consensus.votes
    .map((v) => `- ${v.name}(${v.tagline}): ${v.vote} [重み${v.weight}${v.active ? "" : "・縮小"}]`)
    .join("\n");

  const prompt = `# 銘柄: ${symbol}

## ① 決定論的な合議シグナル（背骨）
現在レジーム: ${REGIME_LABEL[consensus.regime.regime]} (ADX=${consensus.regime.adx?.toFixed(1) ?? "N/A"}, 価格/EMA=${consensus.regime.priceVsMa != null ? (consensus.regime.priceVsMa * 100).toFixed(1) + "%" : "N/A"}, ボラ分位=${consensus.regime.atrPercentile != null ? Math.round(consensus.regime.atrPercentile * 100) + "%ile" : "N/A"})
ネットスタンス: ${consensus.netStance} / 加重スコア ${consensus.score.toFixed(2)}(-1〜+1) / 一致度 ${Math.round(consensus.agreement * 100)}%
モデル別投票:
${votesText}

## ② 文脈（ニュース / X・SNS のナラティブ）
${contextText}

# 依頼
①を背骨、②を補助として、この銘柄の総合アドバイスを構造化して返せ。
- stance/confidence/horizon を決める(合議と文脈が矛盾するなら confidence を下げ、neutral/avoid も選択肢)
- keyDrivers(主因) と keyRisks(リスク) を具体的に
- invalidation: この見立てが崩れる条件を1つ
- riskNote: サイズ・ロスカット・レバの注意(リスク管理の観点で)
- sources: ②で参照した主要出典(title, url)。無ければ空配列`;

  const res: Anthropic.Message = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (res.stop_reason === "refusal") throw new Error("モデルが応答を拒否しました");

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("応答テキストがありません");

  const parsed = JSON.parse(textBlock.text) as Advisory;
  return {
    ...parsed,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    keyDrivers: parsed.keyDrivers ?? [],
    keyRisks: parsed.keyRisks ?? [],
    sources: (parsed.sources ?? []).filter((s) => s && s.url),
  };
}
