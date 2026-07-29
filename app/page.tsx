import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Calculator, Wallet, BookOpen } from "lucide-react";

const FEATURES = [
  {
    icon: Wallet,
    title: "デモトレード",
    desc: "仮想資金でBTC/USDTを成行・指値、ロング/ショート、レバレッジ最大20xまで練習。実現/未実現損益をリアルタイム表示。",
  },
  {
    icon: Calculator,
    title: "税金シミュレーション",
    desc: "日本の現行累進課税（5〜45%＋住民税）と2028年以降の分離課税20.315%を切り替えて手取り利益を試算。",
  },
  {
    icon: LineChart,
    title: "資産推移の可視化",
    desc: "仮想資産と税引後利益の推移をグラフで確認。戦略の検証を継続的に。",
  },
  {
    icon: BookOpen,
    title: "市場観＆ノート",
    desc: "よく使われる手法やサイクル議論をまとめて確認。自分の仮説はノートに残せる。",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 py-8">
      <section className="space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          実資金ゼロで、
          <br className="sm:hidden" />
          勝てる戦略を検証する。
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          暗号通貨のデモトレード・戦略検証・日本の税金シミュレーションを1つに。
          リスクなしで練習し、手取りベースで利益を最大化しましょう。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">はじめる</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/tax-simulator">税金シミュを試す</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ※ 本ツールはシミュレーションであり、投資助言・税務助言ではありません。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{f.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {f.desc}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
