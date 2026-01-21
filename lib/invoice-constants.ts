// Invoice categories
export const INVOICE_CATEGORIES = [
  "車票",
  "住宿",
  "AI",
  "辦公用品",
  "五金",
  "電腦周邊",
  "餐費",
] as const;

export type InvoiceCategory = (typeof INVOICE_CATEGORIES)[number];

// Currency types
export const INVOICE_CURRENCIES = ["TWD", "USD"] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];
