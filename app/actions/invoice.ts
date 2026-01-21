"use server";

import type { InvoiceCategory, InvoiceCurrency } from "@/lib/invoice-constants";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { extractText } from "unpdf";

// Extract text from PDF for AI parsing
async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true });
  return text;
}

export interface Invoice {
  id: string;
  user_id: string;
  image_url: string;
  file_type?: string | null;
  date: string;
  category?: string | null;
  name: string;
  amount: number;
  currency?: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string | null;
  user_name?: string | null;
}

// Parsed invoice data from AI
export interface ParsedInvoiceData {
  date: string;
  category: InvoiceCategory;
  name: string;
  amount: number;
  currency: InvoiceCurrency;
}

// JSON schema for structured outputs
const invoiceJsonSchema = {
  name: "invoice_data",
  strict: true,
  schema: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Invoice date in YYYY-MM-DD format",
      },
      category: {
        type: "string",
        enum: ["車票", "住宿", "AI", "辦公用品", "五金", "電腦周邊", "餐費"],
        description: "Product category",
      },
      name: {
        type: "string",
        description: "Product or service name",
      },
      amount: {
        type: "number",
        description: "Total amount without currency symbol",
      },
      currency: {
        type: "string",
        enum: ["TWD", "USD"],
        description: "Currency type",
      },
    },
    required: ["date", "category", "name", "amount", "currency"],
    additionalProperties: false,
  },
} as const;

const systemPrompt = `You are an invoice parser. Analyze the invoice content and extract the following information:
- date: The invoice date in YYYY-MM-DD format
- category: Must be one of: 車票, 住宿, AI, 辦公用品, 五金, 電腦周邊, 餐費
- name: The product or service name
- amount: The total amount as a number (without currency symbol)
- currency: Must be TWD or USD based on the invoice

If you cannot determine a field, make a reasonable guess based on the context.
For category, analyze the products/services on the invoice and pick the most appropriate category.`;

// Parse invoice using OpenAI GPT-5.2 with structured outputs
export async function parseInvoice(formData: FormData): Promise<{
  data?: ParsedInvoiceData;
  error?: string;
}> {
  try {
    const imageFile = formData.get("image") as File;

    if (!imageFile || imageFile.size === 0) {
      return { error: "請選擇有效的檔案" };
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(imageFile.type)) {
      return { error: "不支援的檔案格式，請上傳圖片或 PDF 檔案" };
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const isPdf = imageFile.type === "application/pdf";

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let response;

    if (isPdf) {
      // For PDF: extract text and send as text prompt
      const pdfText = await extractPdfText(arrayBuffer);

      if (!pdfText || pdfText.trim().length === 0) {
        return { error: "無法從 PDF 中提取文字，請嘗試上傳圖片格式" };
      }

      response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Please analyze this invoice text and extract the required information:\n\n${pdfText}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: invoiceJsonSchema,
        },
        max_completion_tokens: 1000,
      });
    } else {
      // For images: use vision capabilities
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = imageFile.type;

      response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this invoice image and extract the required information.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: invoiceJsonSchema,
        },
        max_completion_tokens: 1000,
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { error: "AI 無法解析發票內容" };
    }

    const parsedData = JSON.parse(content) as ParsedInvoiceData;
    return { data: parsedData };
  } catch (error) {
    console.error("Parse invoice error:", error);
    return {
      error: error instanceof Error ? error.message : "解析發票時發生錯誤",
    };
  }
}

export interface InvoiceWithUser extends Invoice {
  user_email: string | null;
  user_name: string | null;
}

export async function uploadInvoice(formData: FormData) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "未登入，請先登入" };
    }

    // Get form data
    const imageFile = formData.get("image") as File;
    const date = formData.get("date") as string;
    const category = formData.get("category") as string;
    const name = formData.get("name") as string;
    const amount = formData.get("amount") as string;
    const currency = formData.get("currency") as string;

    // Validate required fields
    if (!imageFile || !date || !name || !amount) {
      return { error: "請填寫所有必填欄位" };
    }

    // Validate file
    if (imageFile.size === 0) {
      return { error: "請選擇有效的檔案" };
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return { error: "檔案大小不能超過 10MB" };
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(imageFile.type)) {
      return { error: "不支援的檔案格式，請上傳圖片或 PDF 檔案" };
    }

    // Determine file type
    const fileType = imageFile.type === "application/pdf" ? "pdf" : "image";

    // Upload file to storage
    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("invoice_files")
      .upload(fileName, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { error: `上傳失敗: ${uploadError.message}` };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("invoice_files").getPublicUrl(fileName);

    // Insert invoice record with new fields
    const { data: invoiceData, error: insertError } = await supabase
      .from("invoice_invoices")
      .insert({
        user_id: user.id,
        image_url: publicUrl,
        file_type: fileType,
        date,
        category: category || null,
        name,
        amount: parseFloat(amount),
        currency: currency || "TWD",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Try to delete uploaded file if insert fails
      await supabase.storage.from("invoice_files").remove([fileName]);
      return { error: `儲存失敗: ${insertError.message}` };
    }

    revalidatePath("/");
    return { success: true, data: invoiceData };
  } catch (error) {
    console.error("Upload invoice error:", error);
    return {
      error: error instanceof Error ? error.message : "發生未知錯誤",
    };
  }
}

export async function getInvoices(): Promise<{
  data: InvoiceWithUser[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    // Get invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoice_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (invoicesError) {
      console.error("Get invoices error:", invoicesError);
      return { data: null, error: invoicesError.message };
    }

    if (!invoices || invoices.length === 0) {
      return { data: [], error: null };
    }

    // Get unique user IDs
    const userIds = [...new Set(invoices.map((inv) => inv.user_id))];

    // Get user profiles
    const { data: userProfiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, email, name")
      .in("id", userIds);

    if (profilesError) {
      console.error("Get user profiles error:", profilesError);
      // Continue without user profiles if there's an error
    }

    // Create a map of user_id to user profile
    const userMap = new Map(
      (userProfiles || []).map((profile) => [
        profile.id,
        { email: profile.email, name: profile.name },
      ])
    );

    // Transform data to include user info
    const invoicesWithUser: InvoiceWithUser[] = invoices.map((invoice) => {
      const userProfile = userMap.get(invoice.user_id);
      return {
        ...invoice,
        user_email: userProfile?.email || null,
        user_name: userProfile?.name || null,
      };
    });

    return { data: invoicesWithUser, error: null };
  } catch (error) {
    console.error("Get invoices error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "發生未知錯誤",
    };
  }
}

export async function deleteInvoice(invoiceId: string) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "未登入，請先登入" };
    }

    // Get invoice to check ownership and get image URL
    const { data: invoice, error: fetchError } = await supabase
      .from("invoice_invoices")
      .select("image_url, user_id")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return { error: "找不到該發票" };
    }

    if (invoice.user_id !== user.id) {
      return { error: "您沒有權限刪除此發票" };
    }

    // Extract file path from URL
    const urlParts = invoice.image_url.split("/invoice_files/");
    const fileName = urlParts[1];

    if (fileName) {
      // Delete file from storage
      await supabase.storage.from("invoice_files").remove([fileName]);
    }

    // Delete invoice record
    const { error: deleteError } = await supabase
      .from("invoice_invoices")
      .delete()
      .eq("id", invoiceId);

    if (deleteError) {
      return { error: `刪除失敗: ${deleteError.message}` };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Delete invoice error:", error);
    return {
      error: error instanceof Error ? error.message : "發生未知錯誤",
    };
  }
}
