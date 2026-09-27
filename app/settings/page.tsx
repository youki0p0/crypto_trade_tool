import { getProfile } from "@/lib/data/queries";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "設定 | Crypto Trade Sim",
};

export default async function SettingsPage() {
  const profile = await getProfile();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">
          プロフィールと仮想資金の管理、ログアウトができます。
        </p>
      </div>

      <SettingsClient profile={profile} />
    </div>
  );
}
