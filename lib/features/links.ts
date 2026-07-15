import { getSupabase } from "@/lib/supabase";
import type { NewProfileLinkInput, ProfileLink, PublicProfile } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function getProfileLinks(ownerId: string): Promise<ProfileLink[]> {
  const { data, error } = await getSupabase()
    .from("profile_links")
    .select("*")
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail("Failed to load links", error);
  return (data ?? []) as ProfileLink[];
}

export async function createProfileLink(ownerId: string, input: NewProfileLinkInput): Promise<ProfileLink> {
  const { data, error } = await getSupabase()
    .from("profile_links")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to save link", error);
  return data as ProfileLink;
}

export async function updateProfileLink(id: string, patch: Partial<NewProfileLinkInput>): Promise<ProfileLink> {
  const { data, error } = await getSupabase().from("profile_links").update(patch).eq("id", id).select().single();
  if (error) fail("Failed to update link", error);
  return data as ProfileLink;
}

export async function deleteProfileLink(id: string): Promise<void> {
  const { error } = await getSupabase().from("profile_links").delete().eq("id", id);
  if (error) fail("Failed to delete link", error);
}

/** Persists a new order after drag-and-drop. */
export async function reorderProfileLinks(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase();
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("profile_links")
        .update({ sort_order: i })
        .eq("id", id)
        .then(({ error }) => {
          if (error) fail("Failed to reorder links", error);
        })
    )
  );
}

/** Public, anonymous read for /u/[userId] — RLS exposes only public links. */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = getSupabase();
  const [userRes, linksRes] = await Promise.all([
    supabase.from("users").select("display_name, photo_url").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_links")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (userRes.error) fail("Failed to load profile", userRes.error);
  if (linksRes.error) fail("Failed to load links", linksRes.error);
  if (!userRes.data) return null;
  return {
    display_name: (userRes.data as { display_name: string | null }).display_name,
    photo_url: (userRes.data as { photo_url: string | null }).photo_url,
    links: (linksRes.data ?? []) as ProfileLink[],
  };
}
