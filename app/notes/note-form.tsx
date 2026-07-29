"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createNote } from "./actions";

export function NoteForm() {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || isPending) return;

    setError(null);
    startTransition(async () => {
      const result = await createNote(content);
      if (result.error) {
        setError(result.error);
        return;
      }
      setContent("");
      textareaRef.current?.focus();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="相場観や仮説を記録する…"
            rows={4}
            maxLength={2000}
            disabled={isPending}
            aria-label="新しいメモ"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="min-h-[1.25rem] flex-1 text-xs">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : (
                <span className="text-muted-foreground">
                  {content.length}/2000文字
                </span>
              )}
            </div>
            <Button
              type="submit"
              disabled={isPending || !content.trim()}
              className="gap-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4" />
              )}
              追加
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
