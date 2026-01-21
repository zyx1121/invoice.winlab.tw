/**
 * Check if file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf";
}

/**
 * Convert PDF file to PNG image (first page only)
 * This runs in the browser using pdf.js
 * Uses dynamic import to avoid SSR issues
 */
export async function convertPdfToImage(pdfFile: File): Promise<File> {
  // Dynamic import to avoid SSR issues (pdfjs-dist uses browser-only APIs)
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source for pdf.js using unpkg CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  // Read PDF file as ArrayBuffer
  const arrayBuffer = await pdfFile.arrayBuffer();

  // Load PDF document
  const pdfDoc = await pdfjsLib.getDocument({
    data: arrayBuffer,
  }).promise;

  // Get first page
  const page = await pdfDoc.getPage(1);

  // Set scale for good quality (2x for better OCR)
  const scale = 2;
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas context");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render page to canvas
  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  // Convert canvas to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
      },
      "image/png",
      1.0
    );
  });

  // Create new File from blob with .png extension
  const originalName = pdfFile.name.replace(/\.pdf$/i, "");
  const newFileName = `${originalName}.png`;

  return new File([blob], newFileName, { type: "image/png" });
}
