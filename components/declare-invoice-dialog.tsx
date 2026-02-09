"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { filesToJpegBlobs } from "@/lib/files-to-jpg";
import { submitInvoice } from "@/lib/invoice-upload";
import { useState } from "react";

interface DeclareInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  onSuccess: () => void;
}

export function DeclareInvoiceDialog({
  open,
  onOpenChange,
  files,
  onSuccess,
}: DeclareInvoiceDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("請填寫申報原因");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const blobs = await filesToJpegBlobs(files);
      await submitInvoice({ reason: reason.trim(), notes: notes.trim(), blobs });
      setReason("");
      setNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const fileCount = files.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>申報發票</DialogTitle>
          <DialogDescription>
            已選擇 {fileCount} 個檔案
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">申報原因 *</Label>
            <Input
              id="reason"
              placeholder="例：設備採購、差旅報銷"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea
              id="notes"
              placeholder="選填"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "上傳中…" : "確認上傳"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
