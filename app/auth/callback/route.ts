import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / メール確認リンクのコールバック。
 * ?code= を受け取りセッションに交換して redirect 先へ遷移する。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
