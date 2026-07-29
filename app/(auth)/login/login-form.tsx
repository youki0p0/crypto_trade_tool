"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  function envMissing() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setMessage({
        type: "error",
        text: "Supabase の環境変数が未設定です。.env.local を設定してください（README参照）。",
      });
      return true;
    }
    return false;
  }

  async function handlePasswordAuth(mode: "signin" | "signup") {
    if (envMissing()) return;
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirect);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteUrl}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
        });
        if (error) throw error;
        setMessage({
          type: "info",
          text: "確認メールを送信しました。メール内のリンクから登録を完了してください。",
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: authErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (envMissing()) return;
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${siteUrl}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
      });
      if (error) throw error;
      // OAuth はリダイレクトするのでここには通常戻らない
    } catch (e) {
      setMessage({ type: "error", text: authErrorMessage(e) });
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ログイン / 新規登録</CardTitle>
        <CardDescription>
          デモ取引・シミュレーション結果を保存するにはログインが必要です。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogle}
          disabled={loading}
        >
          <Mail className="h-4 w-4" />
          Google で続ける
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">または</span>
          </div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">ログイン</TabsTrigger>
            <TabsTrigger value="signup">新規登録</TabsTrigger>
          </TabsList>

          {(["signin", "signup"] as const).map((mode) => (
            <TabsContent key={mode} value={mode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`${mode}-email`}>メールアドレス</Label>
                <Input
                  id={`${mode}-email`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-password`}>パスワード</Label>
                <Input
                  id={`${mode}-password`}
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => handlePasswordAuth(mode)}
                disabled={loading || !email || password.length < 6}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "ログイン" : "登録する"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>

        {message && (
          <p
            className={
              message.type === "error"
                ? "text-sm text-destructive"
                : "text-sm text-[hsl(var(--profit))]"
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function authErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return "メールアドレスまたはパスワードが正しくありません。";
  if (/already registered/i.test(msg)) return "このメールアドレスは既に登録されています。";
  if (/provider is not enabled|not enabled/i.test(msg))
    return "この認証方法は Supabase 側で有効化されていません（README参照）。";
  return msg || "認証に失敗しました。";
}
