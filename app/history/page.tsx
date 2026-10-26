import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { getTrades, getTaxSimulations } from "@/lib/data/queries";
import { formatUSDT, formatJPY, cn } from "@/lib/utils";
import { TAX_MODE_LABELS } from "@/lib/tax/schema";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata = {
  title: "取引履歴 | Crypto Trade Sim",
};

function formatDateTime(iso: string): string {
  return format(new Date(iso), "yyyy/MM/dd HH:mm", { locale: ja });
}

export default async function HistoryPage() {
  const [trades, simulations] = await Promise.all([getTrades(), getTaxSimulations()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">取引履歴</h1>
        <p className="text-muted-foreground">
          デモ取引の記録と、保存した税シミュレーションの履歴を確認できます。
        </p>
      </div>

      <Tabs defaultValue="trades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trades">デモ取引</TabsTrigger>
          <TabsTrigger value="tax">税シミュ履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="trades">
          {trades.length === 0 ? (
            <EmptyState message="まだデモ取引の記録がありません。トレード画面から取引を行うとここに表示されます。" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日時</TableHead>
                      <TableHead>シンボル</TableHead>
                      <TableHead>方向</TableHead>
                      <TableHead>種別</TableHead>
                      <TableHead className="text-right">エントリー価格</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">レバレッジ</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead className="text-right">損益</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(trade.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.side === "long" ? "profit" : "loss"}>
                            {trade.side === "long" ? "ロング" : "ショート"}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.type === "market" ? "成行" : "指値"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUSDT(trade.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {trade.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ×{trade.leverage}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.status === "open" ? "secondary" : "outline"}>
                            {trade.status === "open" ? "保有中" : "決済済"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-medium",
                            trade.status === "closed" && trade.pnl !== null
                              ? trade.pnl >= 0
                                ? "text-[hsl(var(--profit))]"
                                : "text-[hsl(var(--loss))]"
                              : "text-muted-foreground"
                          )}
                        >
                          {trade.status === "closed" && trade.pnl !== null
                            ? `${trade.pnl >= 0 ? "+" : ""}${formatUSDT(trade.pnl)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tax">
          {simulations.length === 0 ? (
            <EmptyState message="保存された税シミュレーション履歴がありません。税金シミュレーション画面から結果を保存できます。" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日時</TableHead>
                      <TableHead>モード</TableHead>
                      <TableHead className="text-right">暗号資産利益</TableHead>
                      <TableHead className="text-right">税額</TableHead>
                      <TableHead className="text-right">手取り</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulations.map((sim) => (
                      <TableRow key={sim.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(sim.created_at)}
                        </TableCell>
                        <TableCell>{TAX_MODE_LABELS[sim.tax_mode]}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatJPY(sim.crypto_profit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[hsl(var(--loss))]">
                          {formatJPY(sim.tax_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-[hsl(var(--profit))]">
                          {formatJPY(sim.net_profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-1 py-16 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
