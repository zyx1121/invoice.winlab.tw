"use client";

import {
  parseInvoice,
  uploadInvoice,
  type ParsedInvoiceData,
} from "@/app/actions/invoice";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVOICE_CATEGORIES,
  INVOICE_CURRENCIES,
} from "@/lib/invoice-constants";
import { convertPdfToImage, isPdfFile } from "@/lib/pdf-to-image";
import { Loader2Icon, PlusIcon, SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";

type Step = "upload" | "review";

export function AddInvoice({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedInvoiceData | null>(null);
  const [category, setCategory] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setStep("upload");
      setSelectedFile(null);
      setParsedData(null);
      setError(null);
      setLoading(false);
      setParsing(false);
      setCategory("");
      setCurrency("");
      if (formRef.current) {
        formRef.current.reset();
      }
    }
  }

  // Handle file selection and AI parsing
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setParsing(true);

    try {
      // Convert PDF to image if needed (client-side conversion)
      let processedFile = file;
      if (isPdfFile(file)) {
        processedFile = await convertPdfToImage(file);
      }

      // Store the processed file (image) for later upload
      setSelectedFile(processedFile);

      const formData = new FormData();
      formData.append("image", processedFile);

      const result = await parseInvoice(formData);

      if (result.error) {
        setError(result.error);
        setParsing(false);
        return;
      }

      if (result.data) {
        setParsedData(result.data);
        setCategory(result.data.category);
        setCurrency(result.data.currency);
        setStep("review");
      }
    } catch (err) {
      console.error("Parse error:", err);
      setError("解析發票時發生錯誤");
    } finally {
      setParsing(false);
    }
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile || !parsedData) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      // Get values from form (allows user edits)
      const form = e.currentTarget;
      const date = (form.elements.namedItem("date") as HTMLInputElement).value;
      const name = (form.elements.namedItem("name") as HTMLInputElement).value;
      const amount = (form.elements.namedItem("amount") as HTMLInputElement).value;

      formData.append("date", date);
      formData.append("category", category);
      formData.append("name", name);
      formData.append("amount", amount);
      formData.append("currency", currency);

      const result = await uploadInvoice(formData);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Success - close dialog and trigger callback
      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError("上傳發票時發生錯誤");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="hover:scale-105 transition-all duration-200">
          <PlusIcon className="w-4 h-4" />
          新增
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form ref={formRef} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新增發票</DialogTitle>
            <DialogDescription>
              {step === "upload"
                ? "上傳發票檔案，AI 將自動辨識內容"
                : "請確認 AI 辨識的資料是否正確"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded-md">
                {error}
              </div>
            )}

            {step === "upload" && (
              <div className="grid gap-2">
                <Label htmlFor="image-upload">發票檔案</Label>
                <Input
                  ref={fileInputRef}
                  id="image-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  disabled={parsing}
                  required
                />
                {parsing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                    <SparklesIcon className="w-4 h-4" />
                    AI 正在辨識發票內容...
                  </div>
                )}
              </div>
            )}

            {step === "review" && parsedData && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-2 rounded-md">
                  <SparklesIcon className="w-4 h-4" />
                  AI 辨識完成，請確認以下資料
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="date">發票日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={parsedData.date}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">商品類型</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger id="category" className="w-full">
                      <SelectValue placeholder="選擇商品類型" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">商品名稱</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={parsedData.name}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">商品總額</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={parsedData.amount}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency">幣別</Label>
                    <Select value={currency} onValueChange={setCurrency} required>
                      <SelectTrigger id="currency" className="w-full">
                        <SelectValue placeholder="選擇幣別" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVOICE_CURRENCIES.map((cur) => (
                          <SelectItem key={cur} value={cur}>
                            {cur}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading || parsing}>
                取消
              </Button>
            </DialogClose>
            {step === "review" && (
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                    上傳中...
                  </>
                ) : (
                  "確認新增"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}