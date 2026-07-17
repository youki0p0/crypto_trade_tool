import { TaxForm } from "./tax-form";

export const metadata = {
  title: "税金シミュレーション | Crypto Trade Sim",
};

export default function TaxSimulatorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">税金シミュレーション</h1>
        <p className="text-muted-foreground">
          暗号資産の利益に対する日本の税金を概算します。現行の総合課税（累進）と、
          2028年以降に議論されている分離課税（20.315%）を切り替えて手取りを比較できます。
        </p>
      </div>
      <TaxForm />
    </div>
  );
}
