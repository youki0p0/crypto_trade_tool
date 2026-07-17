"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePrice } from "@/hooks/use-price";
import { openPosition, closePosition } from "./actions";
import {
  TRADABLE_SYMBOLS,
  SYMBOL_LABELS,
  type OrderInput,
} from "@/lib/trade/schema";
import { computePnL, requiredMargin, liquidationPrice } from "@/lib/trade/pnl";
import { summarizePortfolio } from "@/lib/data/portfolio";
import { formatUSDT, formatNumber, formatPercent, cn } from "@/lib/utils";
import type { PaperTrade, Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, TrendingUp, TrendingDown, Wifi, WifiOff } from "lucide-react";

export function TradeClient({
  profile,
  openTrades,
}: {
  profile: Profile | null;
  openTrades: PaperTrade[];
}) {
  const router = useRouter();
  const { prices, loading: priceLoading, error: priceError } = usePrice([
    ...TRADABLE_SYMBOLS,
  ]);

  const [symbol, setSymbol] = useState<OrderInput["symbol"]>("BTCUSDT");
  const [side, setSide] = useState<OrderInput["side"]>("long");
  const [type, setType] = useState<OrderInput["type"]>("market");
  const [quantity, setQuantity] = useState("0.01");
  const [leverage, setLeverage] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [closingId, setClosingId] = useState<string | null>(null);

  const currentPrice = prices[symbol]?.price;
  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(prices)) m[k] = v.price;
    return m;
  }, [prices]);

  const portfolio = useMemo(
    () => summarizePortfolio(profile?.initial_balance ?? 10000, openTrades, priceMap),
    [profile?.initial_balance, openTrades, priceMap]
  );

  const qtyNum = Number(quantity) || 0;
  const estEntry = type === "limit" ? Number(limitPrice) || 0 : currentPrice ?? 0;
  const estMargin = estEntry > 0 ? requiredMargin(estEntry, qtyNum, leverage) : 0;

  function submit() {
    setFormError(null);
    const payload: OrderInput = {
      symbol,
      side,
      type,
      quantity: qtyNum,
      leverage,
      limitPrice: type === "limit" ? Number(limitPrice) : undefined,
    };
    startTransition(async () => {
      const res = await openPosition(payload);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function close(id: string) {
    setClosingId(id);
    startTransition(async () => {
      const res = await closePosition(id);
      setClosingId(null);
      if (res.error) {
        setFormError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 左: 発注フォーム */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>新規注文</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* シンボル + 現在価格 */}
          <div className="space-y-2">
            <Label>銘柄</Label>
            <Select value={symbol} onValueChange={(v) => setSymbol(v as OrderInput["symbol"])}>
              <SelectTrigger>
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
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                {priceLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : priceError ? (
                  <WifiOff className="h-3 w-3 text-destructive" />
                ) : (
                  <Wifi className="h-3 w-3 text-[hsl(var(--profit))]" />
                )}
                現在価格
              </span>
              <span className="font-bold tabular-nums">
                {currentPrice ? formatUSDT(currentPrice) : "—"}
              </span>
            </div>
          </div>

          {/* ロング/ショート */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={side === "long" ? "default" : "outline"}
              className={cn(side === "long" && "bg-[hsl(var(--profit))] hover:bg-[hsl(var(--profit))]/90")}
              onClick={() => setSide("long")}
            >
              <TrendingUp className="h-4 w-4" /> ロング
            </Button>
            <Button
              type="button"
              variant={side === "short" ? "default" : "outline"}
              className={cn(side === "short" && "bg-[hsl(var(--loss))] hover:bg-[hsl(var(--loss))]/90")}
              onClick={() => setSide("short")}
            >
              <TrendingDown className="h-4 w-4" /> ショート
            </Button>
          </div>

          {/* 成行/指値 */}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={type === "market" ? "secondary" : "ghost"} onClick={() => setType("market")}>
              成行
            </Button>
            <Button type="button" variant={type === "limit" ? "secondary" : "ghost"} onClick={() => setType("limit")}>
              指値
            </Button>
          </div>

          {type === "limit" && (
            <div className="space-y-2">
              <Label htmlFor="limitPrice">指値価格 (USDT)</Label>
              <Input
                id="limitPrice"
                type="number"
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice ? String(Math.round(currentPrice)) : "価格"}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">数量</Label>
            <Input
              id="quantity"
              type="number"
              inputMode="decimal"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="leverage">レバレッジ</Label>
              <span className="text-sm font-bold">{leverage}x</span>
            </div>
            <input
              id="leverage"
              type="range"
              min={1}
              max={20}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* 概算 */}
          <div className="space-y-1 rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">必要証拠金</span>
              <span className="tabular-nums">{formatUSDT(estMargin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">想定元本</span>
              <span className="tabular-nums">{formatUSDT(estEntry * qtyNum)}</span>
            </div>
            {estEntry > 0 && qtyNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">概算ロスカット価格</span>
                <span className="tabular-nums">
                  {formatUSDT(
                    liquidationPrice({ side, entryPrice: estEntry, quantity: qtyNum, leverage })
                  )}
                </span>
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button
            className="w-full gap-2"
            onClick={submit}
            disabled={pending || qtyNum <= 0 || (type === "market" && !currentPrice)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {side === "long" ? "ロング" : "ショート"}を建てる
          </Button>
          <p className="text-xs text-muted-foreground">
            ※ デモ取引です。指値は簡略化のため指定価格で即時約定として扱います。
          </p>
        </CardContent>
      </Card>

      {/* 右: サマリ + ポジション */}
      <div className="space-y-6 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="総資産 (Equity)" value={formatUSDT(portfolio.equity)} />
          <StatCard label="現金残高" value={formatUSDT(portfolio.cashBalance)} />
          <StatCard
            label="未実現損益"
            value={formatUSDT(portfolio.unrealizedPnl)}
            tone={portfolio.unrealizedPnl >= 0 ? "profit" : "loss"}
          />
          <StatCard label="保有ポジション" value={String(portfolio.openPositions)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>保有ポジション</CardTitle>
          </CardHeader>
          <CardContent>
            {openTrades.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                保有中のポジションはありません。左のフォームから注文してください。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>銘柄</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead className="text-right">エントリー</TableHead>
                    <TableHead className="text-right">現在価格</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">未実現損益</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openTrades.map((t) => {
                    const cur = prices[t.symbol]?.price;
                    const pnl =
                      cur != null
                        ? computePnL(
                            { side: t.side, entryPrice: t.price, quantity: t.quantity, leverage: t.leverage },
                            cur
                          )
                        : null;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {SYMBOL_LABELS[t.symbol as keyof typeof SYMBOL_LABELS] ?? t.symbol}
                          <span className="ml-1 text-xs text-muted-foreground">{t.leverage}x</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.side === "long" ? "profit" : "loss"}>
                            {t.side === "long" ? "ロング" : "ショート"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(t.price)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cur != null ? formatNumber(cur) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(t.quantity, 4)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            pnl == null
                              ? ""
                              : pnl >= 0
                                ? "text-[hsl(var(--profit))]"
                                : "text-[hsl(var(--loss))]"
                          )}
                        >
                          {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${formatNumber(pnl)}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending && closingId === t.id}
                            onClick={() => close(t.id)}
                          >
                            {pending && closingId === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "決済"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-lg font-bold tabular-nums",
            tone === "profit" && "text-[hsl(var(--profit))]",
            tone === "loss" && "text-[hsl(var(--loss))]"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
