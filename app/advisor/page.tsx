import { AdvisorClient } from "./advisor-client";

export const metadata = { title: "AIアドバイザー | Crypto Trade Sim" };

export default function AdvisorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AIアドバイザー</h1>
        <p className="text-muted-foreground">
          5戦略モデルをレジームで重み付けした「合議シグナル」を背骨に、ニュースやX・SNSで話題の
          ナラティブ（web検索で収集）を融合して、根拠・リスク・無効化条件つきの総合アドバイスを提示します。
          予測ではなく「確率的エッジの合議＋文脈＋リスク管理」です。
        </p>
      </div>
      <AdvisorClient />
    </div>
  );
}
