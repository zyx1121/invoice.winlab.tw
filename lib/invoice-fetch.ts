"use client";

import { createClient } from "@/lib/supabase/client";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { getInvoiceImageUrl } from "@/lib/invoice-upload";

/** Check if current user has invoice admin role (user_profiles.roles.invoice includes "admin"). */
export async function getInvoiceAdminRole(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return false;
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();
  if (error || !profile?.roles) return false;
  const roles = profile.roles as Record<string, string[]>;
  const invoiceRoles = roles?.invoice ?? [];
  return Array.isArray(invoiceRoles) && invoiceRoles.includes("admin");
}

export async function fetchUserInvoices(): Promise<InvoiceRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceRecord[];
}

/**
 * Get first image URL for an invoice (for card thumbnail).
 * For full list of URLs use record.image_paths.map(getInvoiceImageUrl).
 */
export function getInvoiceThumbnailUrl(record: InvoiceRecord): string {
  const path = record.image_paths?.[0];
  return path ? getInvoiceImageUrl(path) : "";
}

export function getInvoiceImageUrls(record: InvoiceRecord): string[] {
  return (record.image_paths ?? []).map(getInvoiceImageUrl);
}
