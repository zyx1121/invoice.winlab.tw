"use client";

import { deleteInvoice } from "@/app/actions/invoice";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DeleteButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId);
      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="relative">
      <Button
        onClick={handleDelete}
        variant="ghost"
        size="icon"
        disabled={isPending}
        className="text-destructive hover:text-destructive"
      >
        <TrashIcon className="w-4 h-4" />
      </Button>
      {error && (
        <div className="absolute top-full right-0 mt-1 text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
