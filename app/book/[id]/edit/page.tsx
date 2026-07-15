"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { BookForm } from "@/components/books/BookForm";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { deleteBook, getBook, updateBook } from "@/lib/database";
import { useToast } from "@/hooks/useToast";
import type { Book, NewBookInput } from "@/types";

export default function EditBookPage() {
  return (
    <AppShell>
      <EditBookContent />
    </AppShell>
  );
}

function EditBookContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void getBook(params.id)
      .then(setBook)
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Failed to load book", "error"))
      .finally(() => setLoading(false));
  }, [params.id, toast]);

  const handleSubmit = async (input: NewBookInput): Promise<void> => {
    try {
      await updateBook(params.id, input);
      toast("Book updated", "success");
      router.replace(`/book/${params.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update book", "error");
    }
  };

  return (
    <>
      <Header title="Edit book" back />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8">
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : book ? (
          <div className="flex flex-col gap-8 animate-fade-up">
            <BookForm initial={book} submitLabel="Save changes" onSubmit={handleSubmit} />
            <div className="rounded-2xl border border-rose/25 bg-rose-soft/60 p-4">
              <p className="text-sm font-semibold text-ink">Danger zone</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink2">
                Deleting this book permanently removes every one of its transactions.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete book
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-ink3">Book not found.</p>
        )}
      </main>

      {book ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete "${book.name}"?`}
          message="This deletes the book and all of its transactions forever. There is no undo."
          confirmLabel="Delete everything"
          destructive
          onConfirm={async () => {
            await deleteBook(book.id);
            toast("Book deleted", "info");
            router.replace("/home");
          }}
        />
      ) : null}
    </>
  );
}
