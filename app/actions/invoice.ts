"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface Invoice {
  id: string;
  user_id: string;
  image_url: string;
  file_type?: string | null;
  date: string;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
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
    const name = formData.get("name") as string;
    const amount = formData.get("amount") as string;

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
    const filePath = `invoice_files/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // Insert invoice record
    const { data: invoiceData, error: insertError } = await supabase
      .from("invoice_invoices")
      .insert({
        user_id: user.id,
        image_url: publicUrl,
        file_type: fileType,
        date,
        name,
        amount: parseFloat(amount),
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
