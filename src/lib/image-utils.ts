// Shared image helpers used across the options pages and popup.

/** Read a File as a data URL (base64). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Render a File into a small square JPEG thumbnail data URL. */
export function createThumbnail(file: File, size = 64): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = url;
  });
}

interface ShrinkOptions {
  type?: string;
  quality?: number;
}

/**
 * Re-encode a (possibly huge full-res) data URL, scaled down to at most
 * maxDim on the longest side. Used to compact legacy full-res cutouts and to
 * keep notification payloads under chrome.tabs.sendMessage's 64MB limit.
 */
export function shrinkDataUrl(
  dataUrl: string,
  maxDim = 1024,
  { type = "image/webp", quality = 0.85 }: ShrinkOptions = {}
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
