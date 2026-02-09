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
