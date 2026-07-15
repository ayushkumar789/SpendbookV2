import { getSupabase } from "@/lib/supabase";
import type { WalletDocType, WalletDocument } from "@/types/features";

const BUCKET = "wallet";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

export async function getWalletDocuments(ownerId: string): Promise<WalletDocument[]> {
  const { data, error } = await getSupabase()
    .from("wallet_documents")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to load documents", error);
  return (data ?? []) as WalletDocument[];
}

export interface NewWalletDocument {
  doc_type: WalletDocType;
  doc_name: string;
  custom_label: string | null;
  has_back: boolean;
  frontFile: File;
  backFile: File | null;
}

/** Creates the record, uploads sides to wallet/{owner}/{id}_front|back.jpg, links paths. */
export async function createWalletDocument(ownerId: string, input: NewWalletDocument): Promise<WalletDocument> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wallet_documents")
    .insert({
      owner_id: ownerId,
      doc_type: input.doc_type,
      doc_name: input.doc_name,
      custom_label: input.custom_label,
      has_back: input.has_back && input.backFile !== null,
    })
    .select()
    .single();
  if (error) fail("Failed to save document", error);
  const doc = data as WalletDocument;

  const upload = async (file: File, side: "front" | "back"): Promise<string> => {
    const path = `${ownerId}/${doc.id}_${side}.jpg`;
    const { error: upError } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (upError) fail(`Failed to upload ${side} side`, upError);
    return path;
  };

  const front_url = await upload(input.frontFile, "front");
  const back_url = input.backFile ? await upload(input.backFile, "back") : null;

  const { data: updated, error: linkError } = await supabase
    .from("wallet_documents")
    .update({ front_url, back_url })
    .eq("id", doc.id)
    .select()
    .single();
  if (linkError) fail("Failed to link document images", linkError);
  return updated as WalletDocument;
}

/** Signed URL valid for an hour — the bucket is private. */
export async function getWalletSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) fail("Failed to load document image", error);
  return data.signedUrl;
}

export async function deleteWalletDocument(doc: WalletDocument): Promise<void> {
  const supabase = getSupabase();
  const paths = [doc.front_url, doc.back_url].filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmError) fail("Failed to delete document files", rmError);
  }
  const { error } = await supabase.from("wallet_documents").delete().eq("id", doc.id);
  if (error) fail("Failed to delete document", error);
}

/** Downloads one side of a document to the user's device. */
export async function downloadWalletSide(doc: WalletDocument, side: "front" | "back"): Promise<void> {
  const path = side === "front" ? doc.front_url : doc.back_url;
  if (!path) throw new Error("No image for this side");
  const url = await getWalletSignedUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to download image");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.doc_name.replace(/[^\w\d]+/g, "-")}-${side}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);
}
