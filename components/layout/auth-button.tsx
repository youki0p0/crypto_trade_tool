"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 環境変数未設定時はボタンを出さない
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  if (!email) {
    return (
      <Button asChild size="sm" variant="outline" className="gap-1">
        <Link href="/login">
          <LogIn className="h-4 w-4" /> ログイン
        </Link>
      </Button>
    );
  }

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-2">
      <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:inline">
        {email}
      </span>
      <Button size="sm" variant="ghost" type="submit">
        ログアウト
      </Button>
    </form>
  );
}
