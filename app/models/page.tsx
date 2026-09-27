import { ModelsClient } from "./models-client";

export const metadata = { title: "AI戦略モデル比較 | Crypto Trade Sim" };

export default function ModelsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI戦略モデル比較</h1>
        <p className="text-muted-foreground">
          手法・リスクヘッジ・リターンの大きさが異なる5つの戦略モデルを、過去データでバックテストして
          リターン／最大ドローダウン／勝率で比較します。守り（DCA）から攻め（高レバ・モメンタム）まで。
        </p>
      </div>
      <ModelsClient />
    </div>
  );
}
