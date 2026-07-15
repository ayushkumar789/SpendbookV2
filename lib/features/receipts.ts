import { getSupabase } from "@/lib/supabase";

const BUCKET = "receipts";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/**
 * Uploads a receipt image to receipts/{ownerId}/{transactionId}.jpg and
 * records the storage path on the transaction. The bucket is private, so
 * we store the path and mint signed URLs for display.
 */
export async function uploadReceipt(ownerId: string, transactionId: string, file: File): Promise<string> {
  const supabase = getSupabase();
  const path = `${ownerId}/${transactionId}.jpg`;
  const { error: upError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (upError) fail("Failed to upload receipt", upError);
  const { error } = await supabase.from("transactions").update({ receipt_url: path }).eq("id", transactionId);
  if (error) fail("Failed to link receipt", error);
  return path;
}

/** Signed URL valid for an hour — enough for a viewing session. */
export async function getReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) fail("Failed to load receipt", error);
  return data.signedUrl;
}

export async function removeReceipt(transactionId: string, path: string): Promise<void> {
  const supabase = getSupabase();
  const { error: rmError } = await supabase.storage.from(BUCKET).remove([path]);
  if (rmError) fail("Failed to delete receipt file", rmError);
  const { error } = await supabase.from("transactions").update({ receipt_url: null }).eq("id", transactionId);
  if (error) fail("Failed to unlink receipt", error);
}
