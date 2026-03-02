"use client";

import { useAuth } from "@/components/auth-context";
import { EditInvoiceDialog } from "@/components/edit-invoice-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchInvoiceById,
  getInvoiceAdminRole,
  getInvoiceImageUrls,
} from "@/lib/invoice-fetch";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { deleteInvoice, updateInvoiceStatus } from "@/lib/invoice-upload";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { ArrowLeft, Ban, Download, Pencil, Stamp, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function StatusBadge({ status }: { status: InvoiceRecord["status"] }) {
  if (status === "approved") {
    return (
      <Badge variant="secondary" className="bg-green-600 text-white border-0 hover:bg-green-600">
        已通過
      </Badge>
    );
  }
  if (status === "rejected") {
    return <Badge variant="destructive">已拒絕</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      審核中
    </Badge>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [isInvoiceAdmin, setIsInvoiceAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(false);
  const [downloadingId, setDownloadingId] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!user) return;
    setInvoiceLoading(true);
    const data = await fetchInvoiceById(id);
    setInvoice(data);
    setInvoiceLoading(false);
  }, [id, user]);

  useEffect(() => {
    if (!user) return;
    loadInvoice();
    getInvoiceAdminRole().then(setIsInvoiceAdmin);
  }, [user, loadInvoice]);

  const handleDownload = useCallback(async () => {
    if (!invoice) return;
    const urls = getInvoiceImageUrls(invoice);
    if (!urls.length) return;
    setDownloadingId(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < urls.length; i++) {
        const res = await fetch(urls[i], { mode: "cors" });
        const blob = await res.blob();
        zip.file(`page_${i + 1}.jpg`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${invoice.reason.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 50)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      const urls2 = getInvoiceImageUrls(invoice);
      if (urls2[0]) window.open(urls2[0], "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(false);
    }
  }, [invoice]);

  const handleDelete = useCallback(async () => {
    if (!invoice || invoice.user_id !== user?.id) return;
    if (!confirm("確定要刪除此申報？")) return;
    setDeletingId(true);
    try {
      await deleteInvoice(invoice.id);
      router.push("/");
    } finally {
      setDeletingId(false);
    }
  }, [invoice, user?.id, router]);

  const handleStatusChange = useCallback(
    async (status: "approved" | "rejected") => {
      if (!invoice || !isInvoiceAdmin) return;
      setUpdatingStatus(true);
      try {
        await updateInvoiceStatus(invoice.id, status);
        await loadInvoice();
      } finally {
        setUpdatingStatus(false);
      }
    },
    [invoice, isInvoiceAdmin, loadInvoice]
  );

  if (authLoading || invoiceLoading) {
    return (
      <main className="w-dvw min-h-dvh flex items-center justify-center">
        <span className="text-muted-foreground/60 text-sm">載入中</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="w-dvw min-h-dvh flex items-center justify-center">
        <span className="text-muted-foreground/60 text-sm">請先登入</span>
      </main>
    );
  }

  if (!invoice) {
    notFound();
  }

  const urls = getInvoiceImageUrls(invoice);
  const isOwner = user.id === invoice.user_id;
  const canSeeUnblurred = isOwner || isInvoiceAdmin;

  return (
    <main className="w-dvw min-h-dvh px-4 py-20 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Back link */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          返回
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-foreground truncate min-w-0">
              {invoice.reason}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {isInvoiceAdmin && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                  onClick={() => handleStatusChange("approved")}
                  disabled={updatingStatus || invoice.status === "approved"}
                  title="通過"
                >
                  <Stamp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => handleStatusChange("rejected")}
                  disabled={updatingStatus || invoice.status === "rejected"}
                  title="拒絕"
                >
                  <Ban className="size-4" />
                </Button>
              </>
            )}
            {isOwner && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setEditOpen(true)}
                title="編輯"
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {(isOwner || isInvoiceAdmin) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleDownload}
                disabled={!urls.length || downloadingId}
                title="下載所有圖片"
              >
                <Download className="size-4" />
              </Button>
            )}
            {isOwner && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deletingId}
                title="刪除"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes ? (
          <p className="text-lg text-muted-foreground/90">{invoice.notes}</p>
        ) : null}

        {/* Creator info */}
        {(invoice.creator_name || invoice.creator_email) && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{invoice.creator_name}</span>
            {invoice.creator_email ? (
              <a
                href={`mailto:${invoice.creator_email}`}
                className="text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {invoice.creator_email}
              </a>
            ) : null}
          </div>
        )}

        {/* Images */}
        <div className="flex flex-col gap-4">
          {urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit max-w-full overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              <img
                src={url}
                alt=""
                className={cn(
                  "max-w-full w-auto h-auto block",
                  !canSeeUnblurred && "blur-[2px]"
                )}
              />
            </a>
          ))}
        </div>
      </div>

      {/* Edit dialog */}
      {editOpen && (
        <EditInvoiceDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          invoice={invoice}
          onSuccess={() => {
            setEditOpen(false);
            loadInvoice();
          }}
        />
      )}
    </main>
  );
}
