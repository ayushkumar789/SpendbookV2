"use client";

import { useEffect, useState } from "react";
import { BookUser, Check } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { createContact, nextContactColor } from "@/lib/features/contacts";
import type { Contact } from "@/types/features";

/** Web Contact Picker API (Chrome Android / not universally supported). */
interface WebContactResult {
  name?: string[];
  tel?: string[];
}
interface WebContactsApi {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<WebContactResult[]>;
}

function webContactsApi(): WebContactsApi | null {
  const api = (navigator as Navigator & { contacts?: WebContactsApi }).contacts;
  return api && typeof api.select === "function" ? api : null;
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
  const [canImport, setCanImport] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setCanImport(Capacitor.isNativePlatform() || webContactsApi() !== null);
  }, []);

  const importFromPhone = async (): Promise<void> => {
    setImporting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Contacts } = await import("@capacitor-community/contacts");
        const perm = await Contacts.requestPermissions();
        if (perm.contacts !== "granted") {
          toast("Contacts permission was denied", "error");
          return;
        }
        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        const picked = result.contact;
        if (picked?.name?.display) setName(picked.name.display);
        if (picked?.phones?.[0]?.number) setPhone(picked.phones[0].number);
      } else {
        const api = webContactsApi();
        if (!api) return;
        const results = await api.select(["name", "tel"], { multiple: false });
        const first = results[0];
        if (first?.name?.[0]) setName(first.name[0]);
        if (first?.tel?.[0]) setPhone(first.tel[0]);
      }
      setNameError(null);
    } catch {
      /* user dismissed the picker — nothing to do */
    } finally {
      setImporting(false);
    }
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

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {canImport ? (
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
      ) : null}

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
