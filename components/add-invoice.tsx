"use client";

import { uploadInvoice } from "@/app/actions/invoice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon } from "lucide-react";
import { useRef, useState } from "react";

export function AddInvoice({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await uploadInvoice(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      // Reset form before closing dialog
      if (formRef.current) {
        formRef.current.reset()
      }
      setOpen(false)
      setLoading(false)
      // Trigger refresh callback
      onSuccess?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="hover:scale-105 transition-all duration-200">
          <PlusIcon className="w-4 h-4" />
          新增
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form ref={formRef} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新增發票</DialogTitle>
            <DialogDescription>
              請上傳並填寫發票資料
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="image-1">發票檔案</Label>
              <Input id="image-1" name="image" type="file" accept="image/*,application/pdf" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date-1">發票日期</Label>
              <Input id="date-1" name="date" placeholder="發票日期" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name-1">商品名稱</Label>
              <Input id="name-1" name="name" placeholder="商品名稱" type="text" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount-1">商品金額</Label>
              <Input id="amount-1" name="amount" placeholder="0" type="number" step="0.01" min="0" required />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>取消</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "上傳中..." : "新增"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}