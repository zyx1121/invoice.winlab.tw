"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ACCEPT } from "@/lib/files-to-jpg";

interface InvoiceDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function InvoiceDropZone({
  onFilesSelected,
  disabled,
  className,
  children,
}: InvoiceDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const normalize = useCallback((files: FileList | null): File[] => {
    if (!files?.length) return [];
    const accepted: File[] = [];
    const types = ACCEPT.split(",").map((t) => t.trim());
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (types.some((t) => f.type === t) || f.type === "application/pdf") {
        accepted.push(f);
      }
    }
    return accepted;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      const accepted = normalize(list);
      if (accepted.length) onFilesSelected(accepted);
      e.target.value = "";
    },
    [normalize, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      const accepted = normalize(e.dataTransfer.files);
      if (accepted.length) onFilesSelected(accepted);
    },
    [disabled, normalize, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn(
        "w-full h-full min-h-dvh flex items-center justify-center outline-none focus-visible:ring-0",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />
      {children}
    </div>
  );
}
