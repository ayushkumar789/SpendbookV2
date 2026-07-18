"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Plus, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { DocumentCard } from "@/components/wallet/DocumentCard";
import { DocumentViewer } from "@/components/wallet/DocumentViewer";
import { AddDocumentWizard } from "@/components/wallet/AddDocumentWizard";
import { AddMethodCard } from "@/components/payment-methods/PaymentMethodCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getWalletDocuments } from "@/lib/features/wallet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { WalletDocument } from "@/types/features";

export default function WalletPage() {
  return (
    <AppShell>
      <WalletContent />
    </AppShell>
  );
}

function WalletContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<WalletDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState<WalletDocument | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setDocs(await getWalletDocuments(user.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load your vault", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <Header
        title="Wallet"
        subtitle="Your documents, always with you"
        hero
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            onClick={() => setAddOpen(true)}
            className="hidden sm:inline-flex"
          >
            Add document
          </Button>
        }
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-jade-soft px-4 py-3 text-sm font-medium animate-fade-in" style={{ color: "var(--jade)" }}>
          <Lock className="h-4 w-4 shrink-0" />
          Stored securely. Only you can access these documents.
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            <Skeleton className="h-[190px] w-[300px] shrink-0 rounded-[18px]" />
            <Skeleton className="h-[190px] w-[300px] shrink-0 rounded-[18px]" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            illustration="methods"
            title="An empty vault"
            message="Keep your PAN, Aadhaar, license and more as digital cards — viewable and downloadable anywhere."
            action={
              <Button size="lg" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add your first document
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-4 pb-2 pt-1">
            {docs.map((d, i) => (
              <DocumentCard key={d.id} doc={d} index={i} onOpen={setViewing} />
            ))}
            <AddMethodCard onClick={() => setAddOpen(true)} />
          </div>
        )}
      </main>

      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add document"
        className="shimmer-border press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-nav transition-transform hover:scale-105 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {addOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "672px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl tracking-tight text-ink">Add to your vault</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
                className="press -mr-1 -mt-1 rounded-full p-2 text-ink3 transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <AddDocumentWizard
              onCancel={() => setAddOpen(false)}
              onDone={() => {
                setAddOpen(false);
                void refresh();
              }}
            />
          </div>
        </div>
      )}

      {viewing ? (
        <DocumentViewer doc={viewing} onClose={() => setViewing(null)} onDeleted={() => void refresh()} />
      ) : null}
    </>
  );
}
