"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { BookForm } from "@/components/books/BookForm";
import { createBook } from "@/lib/database";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { NewBookInput } from "@/types";

export default function CreateBookPage() {
  return (
    <AppShell>
      <CreateBookContent />
    </AppShell>
  );
}

function CreateBookContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (input: NewBookInput): Promise<void> => {
    if (!user) return;
    try {
      const book = await createBook(user.id, input);
      toast(`"${book.name}" is ready`, "success");
      router.replace(`/book/${book.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create book", "error");
    }
  };

  return (
    <>
      <Header title="New book" subtitle="One ledger, one story" back />
      <main className="mx-auto max-w-xl px-4 py-6 md:px-8 animate-fade-up">
        <BookForm submitLabel="Create book" onSubmit={handleSubmit} />
      </main>
    </>
  );
}
