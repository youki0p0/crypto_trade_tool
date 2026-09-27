import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { BadgeProps } from "@/components/ui/badge";
import {
  Repeat,
  TrendingUp,
  Zap,
  LineChart,
  ShieldCheck,
  Target,
  Activity,
} from "lucide-react";

export const metadata = {
  title: "市場観 | Crypto Trade Sim",
};

type RiskLevel = "低" | "中" | "高";

const riskBadgeVariant: Record<RiskLevel, BadgeProps["variant"]> = {
  低: "secondary",
  中: "default",
  高: "loss",
};

const methods: {
  icon: React.ElementType;
  title: string;
  description: string;
  risk: RiskLevel;
}[] = [
  {
    icon: Repeat,
    title: "DCA（ドルコスト平均法）",
    description:
      "定期的に一定額を積立。感情を排除し取得単価を平準化する、最も基本的な手法。",
    risk: "低",
  },
  {
    icon: LineChart,
    title: "チャネル/レンジ押し目買い",
    description:
      "蓄積（レンジ）相場でサポート付近を分割で買う。相場観の見極めがやや必要。",
    risk: "中",
  },
  {
    icon: Zap,
    title: "スキャルピング",
    description:
      "数分〜数十分の短期売買で小さな利ざやを積み重ねる。高頻度で判断力と集中力を要する。",
    risk: "高",
  },
  {
    icon: TrendingUp,
    title: "トレンドフォロー",
    description:
      "上位時間軸の方向に順張りし、損切りを機械的に実行する。トレンド転換時のダマシに注意。",
    risk: "中",
  },
  {
    icon: ShieldCheck,
    title: "リスク管理重視",
    description:
      "ポジションサイジングと損切り徹底により、1トレードの損失を口座資金の1〜2%に制限する。手法というより土台となる考え方。",
    risk: "低",
  },
];

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">市場観</h1>
        <p className="text-muted-foreground">
          暗号通貨市場でよく観測される手法や議論を静的に整理したページです。X（旧Twitter）等での一般的な調査知見をもとにまとめています。
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">よく使われている手法</h2>
          <p className="text-sm text-muted-foreground">
            相場参加者の間で頻繁に言及される代表的な手法とリスク度の目安です。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <Card key={method.title}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <Badge variant={riskBadgeVariant[method.risk]}>
                      リスク: {method.risk}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{method.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{method.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">買い目の傾向</h2>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-3">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                蓄積相場（accumulation）での押し目狙いが主流とされる。急騰の追いかけ（FOMO）よりも、サポート再テストや出来高が細るタイミングを狙って分割エントリーする考え方が多く語られる。
              </p>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                明確な損切りラインとセットで語られることが多く、エントリー根拠が崩れた場合の撤退基準を事前に決めておく姿勢が重視される。
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            サイクル・オンチェーン指標の議論状況
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">4年サイクル（半減期起点）論</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                半減期後の需給引き締めが強気材料とされる一方、ETF資金流入や機関投資家参入により「今回は違う／サイクルが弱まる」という議論も併存している。
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">オンチェーン指標</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                MVRV、SOPR、取引所残高、長期保有者（LTH）の動向などが、割高／割安や利確圧力を判断する材料として使われる。
              </CardDescription>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground">
          結論は出ておらず、これらの指標は「確度の高い予言」ではなく「確率的な状況把握」として使うのが一般的な論調である。
        </p>
      </section>

      <Separator />

      <p className="text-xs text-muted-foreground">
        本ページは一般的に観測される手法・議論の整理であり、投資助言ではありません。最終判断は自己責任で。
      </p>
    </div>
  );
}
