"use client";

const PDF_WORKER_URL =
  "https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs";

const ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
].join(",");

function isPdf(file: File): boolean {
  return file.type === "application/pdf";
}

/** Draw image (or image from URL) to canvas and export as JPEG blob. */
function imageToJpegBlob(
  source: HTMLImageElement | HTMLCanvasElement,
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    let width: number;
    let height: number;
    const maxWidth = 1600;
    const maxHeight = 2400;

    if (source instanceof HTMLImageElement) {
      width = source.naturalWidth;
      height = source.naturalHeight;
    } else {
      width = source.width;
      height = source.height;
    }

    let scale = 1;
    if (width > maxWidth || height > maxHeight) {
      const scaleW = maxWidth / width;
      const scaleH = maxHeight / height;
      scale = Math.min(scaleW, scaleH);
    }
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("No canvas context"));
      return;
    }
    if (scale !== 1) ctx.scale(scale, scale);
    if (source instanceof HTMLImageElement) {
      ctx.drawImage(source, 0, 0);
    } else {
      ctx.drawImage(source, 0, 0);
    }
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality
    );
  });
}

/** Convert a single image file to JPEG blob (optional resize). */
async function imageFileToJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = url;
    });
    return imageToJpegBlob(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convert all pages of a PDF to JPEG blobs. */
async function pdfToJpegBlobs(file: File): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const numPages = doc.numPages;
  const blobs: Blob[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    }).promise;
    blobs.push(await imageToJpegBlob(canvas));
  }
  return blobs;
}

/**
 * Convert a single file to one or more JPEG blobs.
 * PDFs produce one blob per page; images produce one blob.
 */
export async function fileToJpegBlobs(file: File): Promise<Blob[]> {
  if (isPdf(file)) {
    return pdfToJpegBlobs(file);
  }
  if (file.type.startsWith("image/")) {
    const blob = await imageFileToJpeg(file);
    return [blob];
  }
  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Process multiple files and return array of JPEG blobs (order preserved).
 */
export async function filesToJpegBlobs(files: File[]): Promise<Blob[]> {
  const results: Blob[] = [];
  for (const file of files) {
    const blobs = await fileToJpegBlobs(file);
    results.push(...blobs);
  }
  return results;
}

export { ACCEPT };
