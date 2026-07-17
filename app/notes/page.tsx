import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { NotebookText } from "lucide-react";
import { getCurrentUser, getNotes } from "@/lib/data/queries";
import { Card, CardContent } from "@/components/ui/card";
import { NoteForm } from "./note-form";
import { DeleteNoteButton } from "./delete-note-button";

export const metadata = {
  title: "メモ | Crypto Trade Sim",
};

export default async function NotesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">メモ</h1>
          <p className="text-muted-foreground">
            メモの閲覧にはログインが必要です。
          </p>
        </div>
      </div>
    );
  }

  const notes = await getNotes();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">メモ</h1>
        <p className="text-muted-foreground">
          相場観や仮説を記録しておき、後から振り返るためのメモ帳です。
        </p>
      </div>

      <NoteForm />

      {notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <NotebookText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              まだメモがありません。相場観や仮説を記録しましょう。
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {note.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </p>
                  </div>
                  <DeleteNoteButton id={note.id} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
