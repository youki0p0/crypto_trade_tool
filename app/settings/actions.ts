"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(50, "表示名は50文字以内で入力してください"),
  initialBalance: z
    .number({ invalid_type_error: "数値を入力してください" })
    .finite("有効な数値を入力してください")
    .min(0, "0以上で入力してください"),
});

export async function updateProfile(
  displayName: string,
  initialBalance: number
): Promise<{ error?: string }> {
  const parsed = updateProfileSchema.safeParse({ displayName, initialBalance });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容が正しくありません" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      initial_balance: parsed.data.initialBalance,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "プロフィールの更新に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {};
}

export async function resetPaperTrades(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です" };
  }

  const { error } = await supabase.from("paper_trades").delete().eq("user_id", user.id);

  if (error) {
    return { error: "取引履歴の削除に失敗しました" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return {};
}
