"use client";

import { useAuth } from "@/components/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getInvoiceAdminRole,
  getInvoiceImageUrls,
  getInvoiceThumbnailUrl,
} from "@/lib/invoice-fetch";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { deleteInvoice, updateInvoiceStatus } from "@/lib/invoice-upload";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { Ban, Download, PanelBottomClose, Stamp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
const STACK_OFFSET_PX = 6;
const ROTATION_RANGE = 8;

function stableRotation(id: string, index: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  const seed = Math.abs(h) + index;
  return ((seed % (ROTATION_RANGE * 2 + 1)) - ROTATION_RANGE) * 0.5;
}

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

interface InvoiceStackProps {
  invoices: InvoiceRecord[];
  onRefresh: () => void;
  spread?: boolean;
  onSpreadChange?: (spread: boolean) => void;
  className?: string;
}

export function InvoiceStack({
  invoices,
  onRefresh,
  spread: controlledSpread,
  onSpreadChange,
  className,
}: InvoiceStackProps) {
  const { user } = useAuth();
  const [internalSpread, setInternalSpread] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isInvoiceAdmin, setIsInvoiceAdmin] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getInvoiceAdminRole().then((ok) => {
      if (mounted) setIsInvoiceAdmin(ok);
    });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const isControlled = controlledSpread !== undefined && onSpreadChange !== undefined;
  const spread = isControlled ? controlledSpread : internalSpread;

  const toggleSpread = useCallback(() => {
    if (isControlled) {
      onSpreadChange?.(!controlledSpread);
    } else {
      setInternalSpread((s) => !s);
    }
  }, [isControlled, controlledSpread, onSpreadChange]);

  const openInNewTab = useCallback((e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleDownloadAll = useCallback(
    async (inv: InvoiceRecord) => {
      const urls = getInvoiceImageUrls(inv);
      if (!urls.length) return;
      setDownloadingId(inv.id);
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
        a.download = `${inv.reason.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 50)}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        window.open(urls[0], "_blank", "noopener,noreferrer");
      } finally {
        setDownloadingId(null);
      }
    },
    [openInNewTab]
  );

  const handleDelete = useCallback(
    async (inv: InvoiceRecord) => {
      if (inv.user_id !== user?.id) return;
      if (!confirm("確定要刪除此申報？")) return;
      setDeletingId(inv.id);
      try {
        await deleteInvoice(inv.id);
        onRefresh();
      } finally {
        setDeletingId(null);
      }
    },
    [user?.id, onRefresh]
  );

  const handleStatusChange = useCallback(
    async (inv: InvoiceRecord, status: "approved" | "rejected") => {
      if (!isInvoiceAdmin) return;
      setUpdatingStatusId(inv.id);
      try {
        await updateInvoiceStatus(inv.id, status);
        onRefresh();
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [isInvoiceAdmin, onRefresh]
  );

  if (invoices.length === 0) return null;

  return (
    <div
      className={cn("flex flex-col items-center justify-center shrink-0", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-3 w-[min(380px,90vw)] shrink-0">
        {!spread ? (
          /* Z-axis stack: explicit size so flex cannot collapse; optional aspect from first image */
          <button
            type="button"
            onClick={toggleSpread}
            className="relative w-[min(380px,90vw)] h-[320px] shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            aria-label="展開發票堆"
          >
            {invoices.map((inv, i) => {
              const rot = stableRotation(inv.id, i);
              const offsetX = (i - invoices.length / 2) * STACK_OFFSET_PX;
              const offsetY = i * STACK_OFFSET_PX;
              const z = invoices.length - 1 - i;
              const thumb = getInvoiceThumbnailUrl(inv);
              const isOwner = user?.id === inv.user_id;
              return (
                <div
                  key={inv.id}
                  className="absolute inset-0 overflow-hidden flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]"
                  style={{
                    zIndex: z,
                    transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rot}deg)`,
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className={cn(
                        "max-h-full max-w-full w-auto h-auto object-contain pointer-events-none",
                        !isOwner && "blur-[2px]"
                      )}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/50 text-sm bg-muted">
                      無預覽
                    </div>
                  )}
                </div>
              );
            })}
          </button>
        ) : (
          /* Newest in center, older downward; extends to viewport bottom; scrollbar hidden */
          <div className="relative w-[min(380px,90vw)] h-dvh min-h-0 shrink-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center scrollbar-hide">
              <div
                className="flex flex-col items-center gap-6 pt-[calc(50vh-200px)] pb-14"
                style={{ minHeight: "min-content" }}
              >
                {invoices.map((inv) => {
                  const urls = getInvoiceImageUrls(inv);
                  const isOwner = user?.id === inv.user_id;
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-col items-center w-full gap-2"
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <p className="text-xl font-bold text-foreground truncate min-w-0">
                            {inv.reason}
                          </p>
                          <StatusBadge status={inv.status} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isInvoiceAdmin && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                onClick={() => handleStatusChange(inv, "approved")}
                                disabled={updatingStatusId === inv.id || inv.status === "approved"}
                                title="通過"
                              >
                                <Stamp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => handleStatusChange(inv, "rejected")}
                                disabled={updatingStatusId === inv.id || inv.status === "rejected"}
                                title="拒絕"
                              >
                                <Ban className="size-4" />
                              </Button>
                            </>
                          )}
                          {(isOwner || isInvoiceAdmin) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleDownloadAll(inv)}
                              disabled={!urls.length || downloadingId === inv.id}
                              title="下載此申報所有照片"
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
                              onClick={() => handleDelete(inv)}
                              disabled={deletingId === inv.id}
                              title="刪除"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {inv.notes ? (
                        <p className="text-lg text-muted-foreground/90 text-left line-clamp-2 w-full">
                          {inv.notes}
                        </p>
                      ) : null}
                      {(inv.creator_name || inv.creator_email) && (
                        <div className="w-full flex justify-between">
                          <p className="text-lg text-muted-foreground text-left w-full">
                            {inv.creator_name}
                          </p>
                          {inv.creator_email ? (
                            <a
                              href={`mailto:${inv.creator_email}`}
                              className="text-lg text-muted-foreground text-right w-full hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.creator_email}
                            </a>
                          ) : (
                            <p className="text-lg text-muted-foreground text-right w-full">
                              {inv.creator_email}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-3 w-full">
                        {urls.map((url, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={(e) => openInNewTab(e, url)}
                            className="w-fit max-w-full overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background cursor-pointer block"
                          >
                            <img
                              src={url}
                              alt=""
                              className={cn(
                                "max-w-full max-h-[78vh] w-auto h-auto block pointer-events-none",
                                !isOwner && "blur-[2px]"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 size-9 bg-background/50 text-foreground/80 backdrop-blur-md border border-border/50 hover:bg-background/70 shadow-lg"
              onClick={toggleSpread}
              title="收合"
            >
              <PanelBottomClose className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
