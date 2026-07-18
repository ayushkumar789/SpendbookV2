import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { getSupabase } from "@/lib/supabase";
import { getPublicAccountBalances } from "@/lib/features/accounts";
import type { SavedProfile, SavedProfileWithBalances } from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/* ————— Share profile (native share sheet with clipboard fallback) ————— */

export function publicProfileUrl(userId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/u/${userId}`;
}

/** Opens the native share sheet where available (Capacitor on Android/iOS,
 *  Web Share API elsewhere); otherwise copies the link. The caller toasts
 *  based on the returned outcome — "shared" needs no toast. */
export async function shareProfileLink(
  userId: string,
  displayName: string | null
): Promise<"shared" | "copied" | "failed"> {
  const profileUrl = publicProfileUrl(userId);
  const name = displayName?.trim() || "A SpendBook user";
  const shareData = {
    title: `${name} on SpendBook`,
    text: `View ${name}'s profile on SpendBook`,
    url: profileUrl,
  };

  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share(shareData);
      return "shared";
    }
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      return "shared";
    }
    await navigator.clipboard.writeText(profileUrl);
    return "copied";
  } catch {
    // User cancelled the sheet or sharing failed — fall back to copying.
    try {
      await navigator.clipboard.writeText(profileUrl);
      return "copied";
    } catch {
      return "failed";
    }
  }
}

/* ————— Saved profiles ————— */

export async function getSavedProfiles(userId: string): Promise<SavedProfile[]> {
  const { data, error } = await getSupabase()
    .from("saved_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load your people", error);
  return (data ?? []) as SavedProfile[];
}

/** Every saved person plus their public account balances (may be empty). */
export async function getSavedProfilesWithBalances(userId: string): Promise<SavedProfileWithBalances[]> {
  const saved = await getSavedProfiles(userId);
  return Promise.all(
    saved.map(async (p) => ({
      ...p,
      balances: await getPublicAccountBalances(p.saved_user_id).catch(() => []),
    }))
  );
}

export async function saveProfile(
  userId: string,
  savedUserId: string,
  displayName: string,
  photoUrl: string | null
): Promise<SavedProfile> {
  const { data, error } = await getSupabase()
    .from("saved_profiles")
    .upsert(
      {
        user_id: userId,
        saved_user_id: savedUserId,
        saved_display_name: displayName,
        saved_photo_url: photoUrl,
      },
      { onConflict: "user_id,saved_user_id" }
    )
    .select()
    .single();
  if (error) fail("Failed to save the profile", error);
  return data as SavedProfile;
}

export async function removeSavedProfile(userId: string, savedUserId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("saved_profiles")
    .delete()
    .eq("user_id", userId)
    .eq("saved_user_id", savedUserId);
  if (error) fail("Failed to remove the profile", error);
}

export async function isProfileSaved(userId: string, savedUserId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("saved_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("saved_user_id", savedUserId)
    .maybeSingle();
  if (error) fail("Failed to check the profile", error);
  return data !== null;
}

/* ————— Realtime ————— */

/** Fires whenever a balance snapshot changes for any of the given public
 *  groups — the People page reloads its cards on that signal. */
export function subscribeToPublicBalances(groupIds: string[], onChange: () => void): () => void {
  if (groupIds.length === 0) return () => undefined;
  const supabase = getSupabase();
  const channel = supabase
    .channel("people-balances")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "account_balance_snapshots",
        filter: `group_id=in.(${groupIds.join(",")})`,
      },
      onChange
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
