"use client";

import { createClient } from "@/lib/supabase/client";
import { INVOICE_BUCKET } from "@/lib/invoice-types";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/invoice-types";

export interface SubmitInvoicePayload {
  reason: string;
  notes: string;
  blobs: Blob[];
}

/**
 * Upload invoice JPEG blobs to storage and create invoice record.
 * Returns the created invoice row or throws.
 */
export async function submitInvoice(
  payload: SubmitInvoicePayload
): Promise<InvoiceRecord> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const recordId = crypto.randomUUID();
  const prefix = `${user.id}/${recordId}`;
  const paths: string[] = [];

  for (let i = 0; i < payload.blobs.length; i++) {
    const name = `page_${i + 1}.jpg`;
    const path = `${prefix}/${name}`;
    const { error: uploadError } = await supabase.storage
      .from(INVOICE_BUCKET)
      .upload(path, payload.blobs[i], {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    paths.push(path);
  }

  const creatorName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    user.email ??
    "";
  const creatorEmail = user.email ?? "";

  const { data: row, error: insertError } = await supabase
    .from("invoice")
    .insert({
      id: recordId,
      user_id: user.id,
      reason: payload.reason,
      notes: payload.notes,
      status: "pending",
      image_paths: paths,
      creator_name: creatorName,
      creator_email: creatorEmail,
    })
    .select()
    .single();

  if (insertError) throw new Error(`Save failed: ${insertError.message}`);
  return row as InvoiceRecord;
}

/**
 * Fetch public URL for an image path in the invoice bucket.
 */
export function getInvoiceImageUrl(path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(INVOICE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete an invoice by id. Only succeeds if the current user is the owner (RLS).
 */
export async function deleteInvoice(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoice").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface UpdateInvoicePayload {
  reason: string;
  notes: string;
  /** Subset of original image_paths to keep (in order). If undefined, keep all. */
  keepPaths?: string[];
  /** New files to append after the kept images. */
  newBlobs?: Blob[];
}

/**
 * Update invoice fields and optionally manage images.
 * Deletes removed paths from storage, uploads new blobs, updates image_paths.
 * Only succeeds if the current user is the owner (RLS).
 */
export async function updateInvoice(
  id: string,
  payload: UpdateInvoicePayload
): Promise<void> {
  const supabase = createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const hasImageChanges =
    payload.keepPaths !== undefined || (payload.newBlobs && payload.newBlobs.length > 0);

  if (!hasImageChanges) {
    const { data: updated, error } = await supabase
      .from("invoice")
      .update({ reason: payload.reason, notes: payload.notes })
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) throw new Error("儲存失敗，請確認您有權限修改此申報");
    return;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("invoice")
    .select("image_paths")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError) throw new Error("找不到此申報或您無權限修改");

  const oldPaths: string[] = existing?.image_paths ?? [];
  const keepPaths = payload.keepPaths ?? oldPaths;

  const pathsToDelete = oldPaths.filter((p) => !keepPaths.includes(p));
  if (pathsToDelete.length > 0) {
    await supabase.storage.from(INVOICE_BUCKET).remove(pathsToDelete);
  }

  const newPaths: string[] = [];
  if (payload.newBlobs && payload.newBlobs.length > 0) {
    const ts = Date.now();
    for (let i = 0; i < payload.newBlobs.length; i++) {
      const path = `${user.id}/${id}/edit_${ts}_${i + 1}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(INVOICE_BUCKET)
        .upload(path, payload.newBlobs[i], { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error(`圖片上傳失敗：${uploadError.message}`);
      newPaths.push(path);
    }
  }

  const { data: updated, error } = await supabase
    .from("invoice")
    .update({ reason: payload.reason, notes: payload.notes, image_paths: [...keepPaths, ...newPaths] })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) throw new Error("儲存失敗，請確認您有權限修改此申報");
}

/**
 * Update invoice status. Only succeeds if the current user has invoice admin role (RLS).
 */
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("invoice")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
