"use client";

import { useState, useCallback } from "react";
import { TRADABLE_SYMBOLS, SYMBOL_LABELS } from "@/lib/trade/schema";
import { KLINE_INTERVALS, type KlineInterval } from "@/lib/market/klines";
import { REGIME_LABEL, type RegimeState } from "@/lib/advisor/regime";
import type { ConsensusResult } from "@/lib/advisor/consensus";
import type { Advisory, AdviceStance } from "@/lib/advisor/synthesize";
import { MODEL_COLORS } from "@/lib/models/colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert, ExternalLink } from "lucide-react";

const INTERVAL_LABELS: Record<KlineInterval, string> = { "1h": "1時間足", "4h": "4時間足", "1d": "日足" };

const VOTE = {
  long: { text: "買い", cls: "text-[hsl(var(--profit))]", icon: TrendingUp },
  short: { text: "売り", cls: "text-[hsl(var(--loss))]", icon: TrendingDown },
  neutral: { text: "様子見", cls: "text-muted-foreground", icon: Minus },
} as const;

const STANCE_LABEL: Record<AdviceStance, { text: string; variant: "profit" | "loss" | "secondary" | "outline" }> = {
  strong_long: { text: "強い買い寄り", variant: "profit" },
  long_bias: { text: "買い寄り", variant: "profit" },
  neutral: { text: "中立", variant: "secondary" },
  short_bias: { text: "売り寄り", variant: "loss" },
  strong_short: { text: "強い売り寄り", variant: "loss" },
  avoid: { text: "見送り", variant: "outline" },
};

const NET_LABEL = {
  long_bias: { text: "ロング寄り", cls: "text-[hsl(var(--profit))]" },
  short_bias: { text: "ショート寄り", cls: "text-[hsl(var(--loss))]" },
  neutral: { text: "中立", cls: "text-muted-foreground" },
} as const;

interface AdvisorResponse {
  symbol: string;
  interval: KlineInterval;
  consensus: ConsensusResult;
  aiEnabled: boolean;
  context: { text: string; searched: boolean } | null;
  advisory: Advisory | null;
  aiError: string | null;
}

export function AdvisorClient() {
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval, setInterval] = useState<KlineInterval>("1d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdvisorResponse | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, interval }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "取得に失敗しました");
      setData(json as AdvisorResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">銘柄</label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRADABLE_SYMBOLS.map((s) => <SelectItem key={s} value={s}>{SYMBOL_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">時間足</label>
            <Select value={interval} onValueChange={(v) => setInterval(v as KlineInterval)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KLINE_INTERVALS.map((iv) => <SelectItem key={iv} value={iv}>{INTERVAL_LABELS[iv]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            アドバイス生成
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {data && (
        <>
          {/* ① 合議シグナル（決定論・常時） */}
          <ConsensusPanel consensus={data.consensus} regime={data.consensus.regime} />

          {/* ②③ AIアドバイス */}
          {data.advisory ? (
            <AdvisoryPanel advisory={data.advisory} context={data.context} />
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {data.aiError
                  ? `AI文脈の統合でエラー: ${data.aiError}`
                  : "AIによるニュース／SNS文脈の統合は未設定です。サーバーに ANTHROPIC_API_KEY を設定すると、ニュース・X の話題を取り込んだ総合アドバイスが表示されます（合議シグナルはキー無しでも常に動作します）。"}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            ※ 本ツールは教育／シミュレーション用途であり投資助言ではありません。合議は確率的エッジの多数決で、未来を予測するものではなく、SNSセンチメントは操作されやすい遅行指標です。レバレッジ戦略はロスカットで資金を大きく失う可能性があります。最終判断は自己責任で。
          </p>
        </>
      )}
    </div>
  );
}

function ConsensusPanel({ consensus, regime }: { consensus: ConsensusResult; regime: RegimeState }) {
  const net = NET_LABEL[consensus.netStance];
  const scorePct = Math.round(((consensus.score + 1) / 2) * 100); // -1..1 → 0..100
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>合議シグナル（5モデルの多数決・決定論）</CardTitle>
          <Badge variant="outline">レジーム: {REGIME_LABEL[regime.regime]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">ネットスタンス</p>
            <p className={cn("text-xl font-bold", net.cls)}>{net.text}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">加重スコア(-1〜+1)</p>
            <p className="text-xl font-bold tabular-nums">{consensus.score.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">一致度</p>
            <p className="text-xl font-bold tabular-nums">{Math.round(consensus.agreement * 100)}%</p>
          </div>
        </div>

        {/* スコアバー */}
        <div className="space-y-1">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-[hsl(var(--loss))]/30 via-muted to-[hsl(var(--profit))]/30">
            <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-foreground" style={{ left: `calc(${scorePct}% - 2px)` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>ショート</span><span>中立</span><span>ロング</span>
          </div>
        </div>

        {/* モデル別内訳 */}
        <div className="grid gap-2 sm:grid-cols-2">
          {consensus.votes.map((v) => {
            const vi = VOTE[v.vote];
            const Icon = vi.icon;
            return (
              <div key={v.modelId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[v.modelId] }} />
                  {v.name}
                  {!v.active && <span className="text-[10px] text-muted-foreground">(縮小)</span>}
                </span>
                <span className={cn("flex items-center gap-1 font-medium", vi.cls)}>
                  <Icon className="h-3.5 w-3.5" />{vi.text}
                  <span className="ml-1 text-[10px] text-muted-foreground">×{v.weight}</span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          レジームに応じた重み付けで各モデルの現在シグナルを合議。得意な相場のモデルほど重い。
        </p>
      </CardContent>
    </Card>
  );
}

function AdvisoryPanel({ advisory, context }: { advisory: Advisory; context: { text: string; searched: boolean } | null }) {
  const st = STANCE_LABEL[advisory.stance];
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> 総合アドバイス（合議＋ニュース／SNS文脈）
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={st.variant}>{st.text}</Badge>
            <span className="text-xs text-muted-foreground">
              確信度 {Math.round(advisory.confidence * 100)}% / {advisory.horizon === "short" ? "短期" : "中期"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>{advisory.summary}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="主因" items={advisory.keyDrivers} tone="profit" />
          <Section title="リスク" items={advisory.keyRisks} tone="loss" />
        </div>

        <div className="rounded-md bg-muted/60 p-3 space-y-2">
          <p><span className="font-medium">この見立てが崩れる条件:</span> {advisory.invalidation}</p>
          <p className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" /><span><span className="font-medium">リスク管理:</span> {advisory.riskNote}</span></p>
        </div>

        {advisory.sources.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">参照ソース</p>
            <ul className="space-y-1">
              {advisory.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />{s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {context && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">収集した文脈ブリーフを表示{context.searched ? "" : "（web検索なし）"}</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{context.text}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: "profit" | "loss" }) {
  return (
    <div>
      <p className={cn("mb-1 font-medium", tone === "profit" ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]")}>{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  );
}
