export type InvoiceStatus = "pending" | "approved" | "rejected";

export interface InvoiceRecord {
  id: string;
  user_id: string;
  reason: string;
  notes: string;
  status: InvoiceStatus;
  image_paths: string[];
  created_at: string;
  creator_name?: string | null;
  creator_email?: string | null;
}

export const INVOICE_BUCKET = "invoice";
