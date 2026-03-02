"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT, filesToJpegBlobs } from "@/lib/files-to-jpg";
import { getInvoiceImageUrls } from "@/lib/invoice-fetch";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { updateInvoice } from "@/lib/invoice-upload";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRecord;
  onSuccess: () => void;
}

export function EditInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: EditInvoiceDialogProps) {
  const [reason, setReason] = useState(invoice.reason);
  const [notes, setNotes] = useState(invoice.notes);
  /** Paths from the original invoice that the user wants to keep */
  const [keepPaths, setKeepPaths] = useState<string[]>(invoice.image_paths ?? []);
  /** New files the user picked to append */
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setReason(invoice.reason);
      setNotes(invoice.notes);
      setKeepPaths(invoice.image_paths ?? []);
      setNewFiles([]);
      setError(null);
    }
  }, [open, invoice]);

  const existingUrls = getInvoiceImageUrls({ ...invoice, image_paths: keepPaths });

  const handleRemoveExisting = (path: string) => {
    setKeepPaths((prev) => prev.filter((p) => p !== path));
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setNewFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleRemoveNew = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("請填寫申報原因");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const originalPaths = invoice.image_paths ?? [];
      const pathsChanged =
        keepPaths.length !== originalPaths.length ||
        keepPaths.some((p, i) => p !== originalPaths[i]);
      const newBlobs = newFiles.length > 0 ? await filesToJpegBlobs(newFiles) : undefined;

      await updateInvoice(invoice.id, {
        reason: reason.trim(),
        notes: notes.trim(),
        keepPaths: pathsChanged ? keepPaths : undefined,
        newBlobs,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯申報</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-reason">申報原因 *</Label>
            <Input
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-notes">備註</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {/* Image management */}
          <div className="grid gap-2">
            <Label>圖片</Label>
            <div className="flex flex-wrap gap-2">
              {/* Existing kept images */}
              {keepPaths.map((path, i) => (
                <div key={path} className="relative group shrink-0">
                  <img
                    src={existingUrls[i]}
                    alt=""
                    className="w-20 h-20 object-cover rounded border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(path)}
                    disabled={submitting}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground",
                      "flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                      "focus:opacity-100 focus:outline-none"
                    )}
                    title="移除此圖片"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {/* New pending files */}
              {newFiles.map((file, i) => (
                <div key={i} className="relative group shrink-0">
                  <div className="w-20 h-20 rounded border border-dashed border-border bg-muted flex items-center justify-center p-1">
                    <span className="text-[10px] text-muted-foreground text-center break-all line-clamp-3 leading-tight">
                      {file.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNew(i)}
                    disabled={submitting}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground",
                      "flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                      "focus:opacity-100 focus:outline-none"
                    )}
                    title="移除此檔案"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {/* Add button */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={submitting}
                className="w-20 h-20 rounded border border-dashed border-border bg-muted hover:bg-muted/80 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors shrink-0"
                title="新增圖片"
              >
                <Plus className="size-5" />
                <span className="text-[10px]">新增</span>
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={handleAddFiles}
              className="sr-only"
              tabIndex={-1}
            />
            {keepPaths.length === 0 && newFiles.length === 0 && (
              <p className="text-xs text-muted-foreground">儲存後將移除所有圖片</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "儲存中…" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
