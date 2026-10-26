import { getProfile, getTrades } from "@/lib/data/queries";
import { TradeClient } from "./trade-client";

export const metadata = { title: "デモトレード | Crypto Trade Sim" };
export const dynamic = "force-dynamic";

export default async function TradePage() {
  const [profile, trades] = await Promise.all([getProfile(), getTrades()]);
  const openTrades = trades.filter((t) => t.status === "open");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">デモトレード</h1>
        <p className="text-muted-foreground">
          仮想資金でBTC/ETH/SOLを取引。成行・指値、ロング/ショート、レバレッジ最大20x。
          価格はサーバー経由で無料APIから取得しています。
        </p>
      </div>
      <TradeClient profile={profile} openTrades={openTrades} />
    </div>
  );
}
