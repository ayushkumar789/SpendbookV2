"use client";

import { useEffect, useState } from "react";
import { Plus, Search, UserX } from "lucide-react";
import { AdaptiveDialog } from "@/components/ui/Modal";
import { AddContactForm } from "@/components/contacts/AddContactForm";
import { useAuth } from "@/hooks/useAuth";
import { cn, getInitials } from "@/lib/helpers";
import { getContacts } from "@/lib/features/contacts";
import type { Contact } from "@/types/features";

/** Small colored-initials circle used wherever a contact appears. */
export function ContactAvatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 72%, #1a120a))`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}

interface ContactPickerProps {
  open: boolean;
  onClose: () => void;
  /** null = the "None" option (only offered when allowNone) */
  onSelect: (contact: Contact | null) => void;
  selectedId?: string | null;
  allowNone?: boolean;
  title?: string;
  /** current transaction type — drives the sheet title ("Received from" / "Paid to") */
  txnType?: "in" | "out";
}

export function ContactPicker({
  open,
  onClose,
  onSelect,
  selectedId = null,
  allowNone = true,
  title,
  txnType,
}: ContactPickerProps) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setQuery("");
    setAdding(false);
    setLoading(true);
    getContacts(user.id)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [open, user]);

  const filtered = query.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          (c.phone ?? "").includes(query.trim())
      )
    : contacts;

  const choose = (contact: Contact | null): void => {
    onSelect(contact);
    onClose();
  };

  const resolvedTitle =
    title ?? (txnType === "in" ? "Received from" : txnType === "out" ? "Paid to" : "Tag a person");

  return (
    <AdaptiveDialog open={open} onClose={onClose} title={adding ? "Add new contact" : resolvedTitle}>
      {adding ? (
        <AddContactForm
          existingCount={contacts.length}
          onCreated={(contact) => choose(contact)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-card-hi px-3.5">
            <Search className="h-4 w-4 shrink-0 text-ink3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts…"
              className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
              aria-label="Search contacts"
            />
          </div>

          <div className="flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
            {allowNone ? (
              <button
                type="button"
                onClick={() => choose(null)}
                className={cn(
                  "press row-sweep flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
                  selectedId === null ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-line-strong"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken">
                  <UserX className="h-4 w-4 text-ink3" />
                </span>
                <span className="flex-1 text-sm font-semibold text-ink">None</span>
              </button>
            ) : null}

            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-ink3">Loading contacts…</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink3">
                {contacts.length === 0 ? "No contacts saved yet." : `No matches for “${query}”.`}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c)}
                  className={cn(
                    "press row-sweep flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
                    selectedId === c.id ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <ContactAvatar name={c.name} color={c.avatar_color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                    {c.phone ? <span className="block truncate text-xs text-ink3">{c.phone}</span> : null}
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-3.5 py-3 text-sm font-semibold text-brand-deep transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <Plus className="h-4 w-4" /> Add new contact
          </button>
        </div>
      )}
    </AdaptiveDialog>
  );
}
