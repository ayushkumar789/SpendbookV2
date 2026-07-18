"use client";

import { useState } from "react";
import { BookUser, Check, Search } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createContact, nextContactColor } from "@/lib/features/contacts";
import type { Contact } from "@/types/features";

/** Web Contact Picker API (Chrome Android; not universally supported). */
interface WebContactResult {
  name?: string[];
  tel?: string[];
}
interface WebContactsApi {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<WebContactResult[]>;
}

function webContactsApi(): WebContactsApi | null {
  if (!("contacts" in navigator)) return null;
  const api = (navigator as Navigator & { contacts?: WebContactsApi }).contacts;
  return api && typeof api.select === "function" ? api : null;
}

interface DeviceContact {
  name: string;
  phone: string | null;
}

interface AddContactFormProps {
  /** how many contacts already exist — drives the cycling avatar color */
  existingCount: number;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}

export function AddContactForm({ existingCount, onCreated, onCancel }: AddContactFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* ————— Device contact import ————— */
  const [view, setView] = useState<"form" | "device">("form");
  const [importing, setImporting] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [deviceQuery, setDeviceQuery] = useState("");
  /** blocking notice shown instead of the list (permission / support / empty) */
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const importFromPhone = async (): Promise<void> => {
    if (importing) return;
    setImporting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Contacts } = await import("@capacitor-community/contacts");
        const perm = await Contacts.requestPermissions();
        if (perm.contacts !== "granted") {
          setImportNotice("Permission denied. Please allow contacts access in your phone settings.");
          setDeviceContacts([]);
          setView("device");
          return;
        }
        const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
        const mapped: DeviceContact[] = (result.contacts ?? [])
          .map((c) => ({
            name: c.name?.display?.trim() ?? "",
            phone: c.phones?.[0]?.number?.trim() || null,
          }))
          .filter((c): c is DeviceContact => c.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        setDeviceContacts(mapped);
        setImportNotice(mapped.length === 0 ? "No contacts found on your device" : null);
        setDeviceQuery("");
        setView("device");
      } else {
        const api = webContactsApi();
        if (!api) {
          setImportNotice("Contact import is only available in the app");
          setDeviceContacts([]);
          setView("device");
          return;
        }
        // The browser shows its own native picker — fill the form directly.
        const results = await api.select(["name", "tel"], { multiple: false });
        const first = results[0];
        if (first?.name?.[0]) setName(first.name[0]);
        if (first?.tel?.[0]) setPhone(first.tel[0]);
        setNameError(null);
      }
    } catch {
      /* user dismissed the picker — nothing to do */
    } finally {
      setImporting(false);
    }
  };

  const pickDeviceContact = (c: DeviceContact): void => {
    setName(c.name);
    setPhone(c.phone ?? "");
    setNameError(null);
    setView("form");
  };

  const save = async (): Promise<void> => {
    if (!user || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("A name is required");
      return;
    }
    setSaving(true);
    try {
      const contact = await createContact(user.id, {
        name: trimmed,
        phone: phone.trim() || null,
        avatar_color: nextContactColor(existingCount),
      });
      toast("Contact saved", "success");
      onCreated(contact);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save contact", "error");
    } finally {
      setSaving(false);
    }
  };

  if (view === "device") {
    const filtered = deviceQuery.trim()
      ? deviceContacts.filter(
          (c) =>
            c.name.toLowerCase().includes(deviceQuery.trim().toLowerCase()) ||
            (c.phone ?? "").includes(deviceQuery.trim())
        )
      : deviceContacts;

    return (
      <div className="flex flex-col gap-3 animate-fade-in">
        {importNotice ? (
          <p className="rounded-xl border border-line bg-sunken px-4 py-6 text-center text-sm text-ink2">
            {importNotice}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-card-hi px-3.5">
              <Search className="h-4 w-4 shrink-0 text-ink3" />
              <input
                value={deviceQuery}
                onChange={(e) => setDeviceQuery(e.target.value)}
                placeholder="Search phone contacts…"
                className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
                aria-label="Search phone contacts"
                autoFocus
              />
            </div>
            <div className="flex max-h-[42vh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-ink3">No matches for “{deviceQuery}”.</p>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={`${c.name}-${c.phone ?? i}`}
                    type="button"
                    onClick={() => pickDeviceContact(c)}
                    className="press row-sweep flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3 text-left transition-all duration-200 hover:border-line-strong"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold text-ink2">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                      {c.phone ? <span className="block truncate text-xs text-ink3">{c.phone}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        <Button type="button" variant="outline" size="md" className="w-full" onClick={() => setView("form")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <Button
        type="button"
        variant="soft"
        size="md"
        className="w-full"
        icon={<BookUser className="h-4 w-4" />}
        loading={importing}
        onClick={() => void importFromPhone()}
      >
        Import from phone contacts
      </Button>

      <Input
        label="Name"
        value={name}
        autoFocus
        maxLength={80}
        placeholder="e.g. Rishi"
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      />
      <Input
        label="Phone · optional"
        value={phone}
        inputMode="tel"
        maxLength={20}
        placeholder="e.g. 98765 43210"
        onChange={(e) => setPhone(e.target.value)}
      />

      <div className="flex gap-2.5">
        <Button type="button" variant="outline" size="md" className="flex-1" onClick={onCancel}>
          Back
        </Button>
        <Button
          type="button"
          size="md"
          className="flex-1"
          icon={<Check className="h-4 w-4" />}
          loading={saving}
          onClick={() => void save()}
        >
          Save contact
        </Button>
      </div>
    </div>
  );
}
