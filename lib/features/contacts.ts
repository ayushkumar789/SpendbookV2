import { getSupabase } from "@/lib/supabase";
import { BOOK_COLORS } from "@/lib/constants";
import type { Contact, NewContactInput } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** Avatar palette — the app's 8 accent colors, cycled in creation order. */
export const CONTACT_COLORS: string[] = BOOK_COLORS.map((c) => c.hex);

export function nextContactColor(existingCount: number): string {
  return CONTACT_COLORS[existingCount % CONTACT_COLORS.length];
}

export async function getContacts(ownerId: string): Promise<Contact[]> {
  const { data, error } = await getSupabase()
    .from("contacts")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) fail("Failed to load contacts", error);
  return (data ?? []) as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await getSupabase().from("contacts").select("*").eq("id", id).maybeSingle();
  if (error) fail("Failed to load contact", error);
  return data as Contact | null;
}

export async function createContact(ownerId: string, input: NewContactInput): Promise<Contact> {
  const { data, error } = await getSupabase()
    .from("contacts")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to save contact", error);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await getSupabase().from("contacts").delete().eq("id", id);
  if (error) fail("Failed to delete contact", error);
}
