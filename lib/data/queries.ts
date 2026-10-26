/**
 * サーバーサイドのデータ取得。Server Component / Route から使用。
 */
import { createClient } from "@/lib/supabase/server";
import type { Profile, PaperTrade, TaxSimulation, Note } from "@/types/database";

/** Supabase の環境変数が設定されているか（未設定時はクライアント生成を避け、空データを返す） */
function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

export async function getTrades(): Promise<PaperTrade[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("paper_trades")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getTaxSimulations(): Promise<TaxSimulation[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_simulations")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getNotes(): Promise<Note[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}
