"use client";

import { useState, useCallback } from "react";
import { MODELS } from "@/lib/models/strategies";
import { runBacktest, type BacktestResult } from "@/lib/models/backtest";
import { MODEL_COLORS } from "@/lib/models/colors";
import { RISK_LABEL } from "@/lib/models/types";
import type { Candle } from "@/lib/models/types";
import { TRADABLE_SYMBOLS, SYMBOL_LABELS } from "@/lib/trade/schema";
import { KLINE_INTERVALS, type KlineInterval } from "@/lib/market/klines";
import { formatPercent, formatUSDT, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModelsEquityChart } from "@/components/charts/models-equity-chart";
import { Loader2, Play, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";

const INTERVAL_LABELS: Record<KlineInterval, string> = {
  "1h": "1時間足",
  "4h": "4時間足",
  "1d": "日足",
};

interface RunState {
  results: BacktestResult[];
  source: "binance" | "coingecko";
  symbol: string;
  interval: KlineInterval;
  bars: number;
}

export function ModelsClient() {
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [interval, setInterval] = useState<KlineInterval>("1d");
  const [capital, setCapital] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/klines?symbol=${symbol}&interval=${interval}&limit=300`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "取得に失敗しました");
      const candles = json.candles as Candle[];
      if (!candles || candles.length < 40) throw new Error("データが不足しています");

      const results = MODELS.map((m) => runBacktest(m, candles, capital));
      setRun({
        results,
        source: json.source,
        symbol,
        interval,
        bars: candles.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "実行に失敗しました");
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, capital]);

  // リターン降順
  const ranked = run
    ? [...run.results].sort((a, b) => b.totalReturnPct - a.totalReturnPct)
    : [];
  const modelById = Object.fromEntries(MODELS.map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      {/* コントロール */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">銘柄</label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADABLE_SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SYMBOL_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">時間足</label>
            <Select value={interval} onValueChange={(v) => setInterval(v as KlineInterval)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KLINE_INTERVALS.map((iv) => (
                  <SelectItem key={iv} value={iv}>
                    {INTERVAL_LABELS[iv]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">初期資金 (USDT)</label>
            <input
              type="number"
              value={capital}
              min={100}
              step={1000}
              onChange={(e) => setCapital(Math.max(100, Number(e.target.value) || 0))}
              className="h-10 w-[140px] rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <Button onClick={execute} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            バックテスト実行
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {run && (
        <>
          <p className="text-xs text-muted-foreground">
            {SYMBOL_LABELS[run.symbol as keyof typeof SYMBOL_LABELS]} / {INTERVAL_LABELS[run.interval]} /{" "}
            {run.bars}本 / データ元: {run.source === "binance" ? "Binance" : "CoinGecko（close近似）"}
            {run.source === "coingecko" && "（high/lowが無いため損切り精度は低下します）"}
          </p>

          {/* 資産曲線 */}
          <Card>
            <CardHeader>
              <CardTitle>資産推移の比較（初期資金=100 に正規化）</CardTitle>
            </CardHeader>
            <CardContent>
              <ModelsEquityChart results={run.results} models={MODELS} />
            </CardContent>
          </Card>

          {/* 成績テーブル */}
          <Card>
            <CardHeader>
              <CardTitle>成績比較（リターン降順）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>モデル</TableHead>
                    <TableHead>リスク</TableHead>
                    <TableHead className="text-right">リターン</TableHead>
                    <TableHead className="text-right">最大DD</TableHead>
                    <TableHead className="text-right">勝率</TableHead>
                    <TableHead className="text-right">取引数</TableHead>
                    <TableHead className="text-right">最終資産</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((r) => {
                    const m = modelById[r.modelId];
                    return (
                      <TableRow key={r.modelId}>
                        <TableCell className="font-medium">
                          <span
                            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                            style={{ backgroundColor: MODEL_COLORS[r.modelId] }}
                          />
                          {m.name}
                          <span className="ml-1 text-xs text-muted-foreground">{m.tagline}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{RISK_LABEL[m.risk]}</Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-bold tabular-nums",
                            r.totalReturnPct >= 0
                              ? "text-[hsl(var(--profit))]"
                              : "text-[hsl(var(--loss))]"
                          )}
                        >
                          {r.totalReturnPct >= 0 ? "+" : ""}
                          {formatPercent(r.totalReturnPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[hsl(var(--loss))]">
                          -{formatPercent(r.maxDrawdownPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(r.winRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.numTrades}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUSDT(r.finalEquity)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="text-muted-foreground">Buy &amp; Hold（参考）</TableCell>
                    <TableCell />
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        (run.results[0]?.buyHoldReturnPct ?? 0) >= 0
                          ? "text-[hsl(var(--profit))]"
                          : "text-[hsl(var(--loss))]"
                      )}
                    >
                      {(run.results[0]?.buyHoldReturnPct ?? 0) >= 0 ? "+" : ""}
                      {formatPercent(run.results[0]?.buyHoldReturnPct ?? 0)}
                    </TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* モデル解説カード（常時表示） */}
      <div className="grid gap-4 md:grid-cols-2">
        {MODELS.map((m) => {
          const r = run?.results.find((x) => x.modelId === m.id);
          return (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: MODEL_COLORS[m.id] }}
                    />
                    {m.name}
                    <span className="text-xs font-normal text-muted-foreground">{m.tagline}</span>
                  </CardTitle>
                  <Badge variant="outline">リスク {RISK_LABEL[m.risk]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row icon={<TrendingUp className="h-3.5 w-3.5" />} label="手法" text={m.method} />
                <Row icon={<ShieldCheck className="h-3.5 w-3.5" />} label="リスクヘッジ" text={m.hedge} />
                <Row icon={<AlertTriangle className="h-3.5 w-3.5" />} label="リターン" text={m.expectedReturn} />
                {r && (
                  <div className="mt-2 flex gap-4 border-t pt-2 text-xs">
                    <span>
                      リターン{" "}
                      <b className={r.totalReturnPct >= 0 ? "text-[hsl(var(--profit))]" : "text-[hsl(var(--loss))]"}>
                        {r.totalReturnPct >= 0 ? "+" : ""}
                        {formatPercent(r.totalReturnPct)}
                      </b>
                    </span>
                    <span>最大DD <b className="text-[hsl(var(--loss))]">-{formatPercent(r.maxDrawdownPct)}</b></span>
                    <span>勝率 <b>{formatPercent(r.winRate)}</b></span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        ※ 過去のバックテスト結果は将来の成績を保証しません。手数料・スリッページ・約定滑りは簡略化しています。
        レバレッジ戦略はロスカット（強制決済）で資金を大きく失う可能性があります。投資助言ではありません。
      </p>
    </div>
  );
}

function Row({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <p>
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{text}</span>
      </p>
    </div>
  );
}
