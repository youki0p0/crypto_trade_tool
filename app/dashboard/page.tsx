import Link from "next/link";
import { getProfile, getTrades, getTaxSimulations } from "@/lib/data/queries";
import { fetchTickers } from "@/lib/market/price";
import { summarizePortfolio, buildEquityCurve } from "@/lib/data/portfolio";
import { formatUSDT, formatJPY, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EquityChart } from "@/components/charts/equity-chart";
import { TaxNetChart } from "@/components/charts/tax-net-chart";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "ダッシュボード | Crypto Trade Sim" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [profile, trades, taxSims] = await Promise.all([
    getProfile(),
    getTrades(),
    getTaxSimulations(),
  ]);

  // オープンポジションの銘柄の現在価格を取得（未実現損益の計算用）
  const openSymbols = Array.from(
    new Set(trades.filter((t) => t.status === "open").map((t) => t.symbol))
  );
  let priceMap: Record<string, number> = {};
  if (openSymbols.length > 0) {
    try {
      const tickers = await fetchTickers(openSymbols);
      priceMap = Object.fromEntries(tickers.map((t) => [t.symbol, t.price]));
    } catch {
      priceMap = {};
    }
  }

  const initialBalance = profile?.initial_balance ?? 10000;
  const portfolio = summarizePortfolio(initialBalance, trades, priceMap);
  const equityCurve = buildEquityCurve(initialBalance, trades);
  const latestNet = taxSims[0]?.net_profit ?? null;

  const totalReturnPct =
    initialBalance > 0 ? (portfolio.equity - initialBalance) / initialBalance : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground">
            {profile?.display_name ? `${profile.display_name} さんの` : ""}仮想ポートフォリオの概況
          </p>
        </div>
        <Button asChild>
          <Link href="/trade">
            取引する <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* サマリカード */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="総資産 (Equity)"
          value={formatUSDT(portfolio.equity)}
          sub={`初期資金 ${formatUSDT(initialBalance)}`}
        />
        <Stat
          label="トータルリターン"
          value={`${totalReturnPct >= 0 ? "+" : ""}${(totalReturnPct * 100).toFixed(2)}%`}
          tone={totalReturnPct >= 0 ? "profit" : "loss"}
        />
        <Stat
          label="実現損益"
          value={formatUSDT(portfolio.realizedPnl)}
          tone={portfolio.realizedPnl >= 0 ? "profit" : "loss"}
        />
        <Stat
          label="未実現損益"
          value={formatUSDT(portfolio.unrealizedPnl)}
          tone={portfolio.unrealizedPnl >= 0 ? "profit" : "loss"}
          sub={`保有 ${portfolio.openPositions} 件`}
        />
      </div>

      {/* チャート */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>仮想資産の推移</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityChart data={equityCurve} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>税引後利益の推移</CardTitle>
          </CardHeader>
          <CardContent>
            <TaxNetChart data={taxSims} />
            {latestNet != null && (
              <p className="mt-2 text-sm text-muted-foreground">
                直近の試算手取り: <span className="font-medium text-foreground">{formatJPY(latestNet)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* クイックリンク */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink href="/trade" title="デモトレード" desc="新規注文・ポジション管理" />
        <QuickLink href="/tax-simulator" title="税シミュレーション" desc="手取り利益を試算" />
        <QuickLink href="/insights" title="市場観" desc="手法・サイクルの整理" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "profit" | "loss";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-bold tabular-nums",
            tone === "profit" && "text-[hsl(var(--profit))]",
            tone === "loss" && "text-[hsl(var(--loss))]"
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group rounded-lg border p-4 transition-colors hover:border-primary hover:bg-primary/5"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{title}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
