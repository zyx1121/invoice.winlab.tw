"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { DeclareInvoiceDialog } from "@/components/declare-invoice-dialog";
import { InvoiceDropZone } from "@/components/invoice-drop-zone";
import { InvoiceStack } from "@/components/invoice-stack";
import { fetchUserInvoices } from "@/lib/invoice-fetch";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const { user, loading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [spread, setSpread] = useState(false);
  const loadInvoices = useCallback(async (isRetry = false) => {
    if (!user) {
      setInvoices([]);
      setFetchError(null);
      return;
    }
    setFetchError(null);
    setInvoicesLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFetchError("請重新整理頁面或重新登入");
        setInvoices([]);
        return;
      }
      const data = await fetchUserInvoices();
      setInvoices(data);
      // If first load returned empty but we have session, retry once (cookie timing)
      if (!isRetry && data.length === 0) {
        const retry = await fetchUserInvoices();
        if (retry.length > 0) setInvoices(retry);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "無法載入發票";
      setFetchError(message);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadInvoices(false);
  }, [user, loadInvoices]);

  const handleFilesSelected = useCallback((files: File[]) => {
    setPendingFiles(files);
    setDialogOpen(true);
  }, []);

  const handleDeclareSuccess = useCallback(() => {
    setPendingFiles([]);
    loadInvoices(true);
  }, [loadInvoices]);

  if (loading) {
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

  return (
    <>
      <main className="w-dvw min-h-dvh fixed inset-0">
        <InvoiceDropZone onFilesSelected={handleFilesSelected}>
          <div
            className="contents"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {invoicesLoading ? (
              <span className="text-muted-foreground/50 text-sm">載入中</span>
            ) : fetchError ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-muted-foreground/80 text-sm">{fetchError}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadInvoices(true);
                  }}
                  className="text-sm text-primary underline underline-offset-2 hover:no-underline"
                >
                  重試
                </button>
              </div>
            ) : (
              <InvoiceStack
                invoices={invoices}
                onRefresh={loadInvoices}
                spread={spread}
                onSpreadChange={setSpread}
              />
            )}
          </div>
        </InvoiceDropZone>
      </main>

      <DeclareInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        files={pendingFiles}
        onSuccess={handleDeclareSuccess}
      />
    </>
  );
}
