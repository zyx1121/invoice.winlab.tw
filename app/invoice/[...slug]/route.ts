import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    // Extract invoice ID from slug (remove file extension if present)
    // slug could be ["id.pdf"] or ["id"]
    const slugString = slug.join("/");
    const invoiceId = slugString.split(".")[0]; // Remove extension if present

    if (!invoiceId) {
      return NextResponse.json(
        { error: "無效的發票 ID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "未登入，請先登入" },
        { status: 401 }
      );
    }

    // Get invoice information
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice_invoices")
      .select("image_url, file_type, name, date")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "找不到該發票" },
        { status: 404 }
      );
    }

    // Extract file path from URL
    const urlParts = invoice.image_url.split("/invoice_files/");
    const fileName = urlParts[1];

    if (!fileName) {
      return NextResponse.json(
        { error: "無效的文件路徑" },
        { status: 400 }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("invoice_files")
      .download(fileName);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "無法下載文件" },
        { status: 500 }
      );
    }

    // Convert blob to array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type and file extension based on file_type
    const isPdf = invoice.file_type === "pdf";
    const contentType = isPdf ? "application/pdf" : fileData.type || "image/jpeg";
    const fileExtension = isPdf ? "pdf" : fileName.split(".").pop() || "jpg";

    // Create safe filename - use invoice name or fallback to invoice ID, add date suffix
    let formattedDate = "";
    if (invoice.date) {
      try {
        // Handle date string (format: YYYY-MM-DD) - convert to yyyymmdd
        const dateStr = typeof invoice.date === "string"
          ? invoice.date
          : invoice.date.toISOString().split("T")[0];

        // Format: YYYY-MM-DD -> yyyymmdd
        formattedDate = `_${dateStr.replace(/-/g, "")}`;
      } catch (error) {
        console.error("Error formatting date:", error);
      }
    }

    const baseName = invoice.name
      ? invoice.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, "").trim().replace(/\s+/g, "_")
      : `invoice-${invoiceId}`;

    const downloadFileName = `${baseName}${formattedDate}.${fileExtension}`;

    // Return file with appropriate headers
    // Use attachment to force download, and set proper filename
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadFileName}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error downloading invoice:", error);
    return NextResponse.json(
      { error: "發生未知錯誤" },
      { status: 500 }
    );
  }
}
