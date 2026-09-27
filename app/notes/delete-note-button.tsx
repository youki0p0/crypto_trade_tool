"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteNote } from "./actions";

export function DeleteNoteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteNote(id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="メモを削除"
        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
