"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const noteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "メモを入力してください。")
    .max(2000, "メモは2000文字以内で入力してください。"),
});

export async function createNote(content: string): Promise<{ error?: string }> {
  const parsed = noteSchema.safeParse({ content });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }

  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    content: parsed.data.content,
  });

  if (error) {
    return { error: "メモの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  revalidatePath("/notes");
  return {};
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  if (!id) {
    return { error: "無効なメモです。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }

  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    return { error: "メモの削除に失敗しました。時間をおいて再度お試しください。" };
  }

  revalidatePath("/notes");
  return {};
}
