/**
 * 文脈層（Claude + web検索・サーバー専用・要ANTHROPIC_API_KEY）。
 * 銘柄の直近ニュース/触媒に加え、X(旧Twitter)・SNSで話題のナラティブやセンチメントを
 * web検索経由で収集し、日本語の簡潔なブリーフとして返す。X APIは使わず規約クリア。
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const SYMBOL_NAME: Record<string, string> = {
  BTCUSDT: "Bitcoin (BTC)",
  ETHUSDT: "Ethereum (ETH)",
  SOLUSDT: "Solana (SOL)",
};

export interface ContextBrief {
  text: string;
  /** web検索が実際に走ったか（材料の鮮度目安） */
  searched: boolean;
}

/**
 * web検索でニュース＋SNS話題を集約したテキストブリーフを返す。
 */
export async function fetchContextBrief(symbol: string): Promise<ContextBrief> {
  const client = new Anthropic();
  const asset = SYMBOL_NAME[symbol] ?? symbol;

  const prompt = `${asset} の「今の相場材料」を調べてください。web検索を使い、直近1〜2週間を中心に:
1. 主要ニュース・オンチェーン/マクロの触媒(ETF資金流出入、金利、規制、大口動向など)
2. X(旧Twitter)や暗号資産SNSで今**話題になっているナラティブ・センチメント**(強気/弱気/思惑)。特定の有力アカウントの主張があれば要約(ただしポジショントークの可能性に留意)
3. 目先の上下双方のリスク要因

出力は日本語で簡潔に。各項目3行以内。最後に「参照ソース」として主要な出典(タイトル+URL)を3〜6件。
注意: これは教育目的の相場整理であり投資助言ではない。断定を避け、センチメントは「操作されやすい遅行指標」として扱う。`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let searched = false;
  let text = "";

  // サーバーツール(web検索)は pause_turn で分割されうるので数回まで継続
  for (let attempt = 0; attempt < 4; attempt++) {
    const res: Anthropic.Message = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    } as Anthropic.MessageCreateParamsNonStreaming);

    for (const block of res.content) {
      if (block.type === "server_tool_use") searched = true;
      if (block.type === "text") text += block.text;
    }

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    break;
  }

  return { text: text.trim() || "(材料を取得できませんでした)", searched };
}
