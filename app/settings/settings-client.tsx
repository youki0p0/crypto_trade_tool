"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import type { Profile } from "@/types/database";
import { updateProfile, resetPaperTrades } from "./actions";

export function SettingsClient({ profile }: { profile: Profile | null }) {
  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} />
      <ResetCard />
      <LogoutCard />
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile | null }) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [initialBalance, setInitialBalance] = useState(
    profile?.initial_balance !== undefined && profile?.initial_balance !== null
      ? String(profile.initial_balance)
      : "0"
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsedBalance = Number(initialBalance);
    if (!Number.isFinite(parsedBalance)) {
      setMessage({ type: "error", text: "初期仮想資金には有効な数値を入力してください" });
      return;
    }

    startTransition(async () => {
      const result = await updateProfile(displayName, parsedBalance);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "保存しました" });
      }
    });
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            プロフィール情報を取得できませんでした。再読み込みしてください。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>表示名と初期仮想資金を変更できます。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" value={profile.email ?? ""} disabled readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">表示名</Label>
            <Input
              id="displayName"
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initialBalance">初期仮想資金（USDT）</Label>
            <Input
              id="initialBalance"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
            {message?.type === "success" && (
              <span className="flex items-center gap-1 text-sm text-[hsl(var(--profit))]">
                <Check className="h-4 w-4" />
                {message.text}
              </span>
            )}
            {message?.type === "error" && (
              <span className="text-sm text-destructive">{message.text}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ResetCard() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  function handleReset() {
    const confirmed = window.confirm(
      "取引履歴をすべて削除し、仮想資金をリセットします。この操作は取り消せません。よろしいですか？"
    );
    if (!confirmed) return;

    setMessage(null);
    startTransition(async () => {
      const result = await resetPaperTrades();
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "取引履歴を削除し、仮想資金をリセットしました" });
      }
    });
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          仮想資金リセット
        </CardTitle>
        <CardDescription>
          すべてのデモ取引履歴を削除し、仮想資金を初期状態に戻します。この操作は取り消せません。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="destructive"
          onClick={handleReset}
          disabled={isPending}
          className="gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          取引履歴をすべて削除して仮想資金をリセット
        </Button>
        {message?.type === "success" && (
          <p className="text-sm text-[hsl(var(--profit))]">{message.text}</p>
        )}
        {message?.type === "error" && (
          <p className="text-sm text-destructive">{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LogoutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ログアウト</CardTitle>
        <CardDescription>このデバイスからログアウトします。</CardDescription>
      </CardHeader>
      <CardContent>
        <Separator className="mb-4" />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline">
            ログアウト
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
