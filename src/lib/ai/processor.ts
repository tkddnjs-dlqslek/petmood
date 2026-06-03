import {
  pipeline,
  env,
  RawImage,
} from "@huggingface/transformers";
import { shrinkDataUrl } from "../image-utils";

env.allowRemoteModels = true;
env.useBrowserCache   = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("/");
}
env.allowLocalModels = false;

let bgRemover: any = null;
let loadPromise: Promise<void> | null = null;

async function ensureBgRemover(log: (msg: string) => void): Promise<void> {
  if (bgRemover) return;
  if (loadPromise) { await loadPromise; return; }

  loadPromise = (async () => {
    try {
      log("Loading background removal model...");
      try {
        bgRemover = await pipeline("background-removal", "briaai/RMBG-1.4", {
          device: "webgpu" as any,
        });
        log("Background removal model ready (GPU)!");
      } catch {
        // WebGPU unavailable — fall back to WASM
        bgRemover = await pipeline("background-removal", "briaai/RMBG-1.4", {
          device: "wasm",
        });
        log("Background removal model ready!");
      }
    } catch (err) {
      // Both backends failed — clear so the next caller can retry instead of
      // re-awaiting a rejected promise forever.
      loadPromise = null;
      throw err;
    }
  })();

  await loadPromise;
}

/** Call on page mount to warm up the model before the user needs it. */
export async function preloadBgRemover(): Promise<void> {
  await ensureBgRemover(() => {});
}

/**
 * Remove background from image.
 * Returns transparent PNG as data URL.
 */
export async function removeBackgroundFromImage(
  imageDataUrl: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const log = onProgress ?? ((msg: string) => console.log("[PetMood]", msg));

  await ensureBgRemover(log);

  // Pre-resize to ≤1024px — reduces pipeline preprocessing time
  const inputUrl = await shrinkDataUrl(imageDataUrl, 1024, {
    type: "image/jpeg",
    quality: 0.92,
  });

  log("Removing background...");
  const output = await bgRemover(inputUrl, { threshold: 0.8 });

  let rawImage: any = null;
  if (output instanceof RawImage) {
    rawImage = output;
  } else if (Array.isArray(output) && output.length > 0) {
    rawImage = output[0] instanceof RawImage ? output[0] : output[0]?.mask;
  }

  if (!rawImage) {
    console.warn("[PetMood] Could not parse background removal output");
    return imageDataUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width  = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext("2d")!;

  if (rawImage.channels === 4) {
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rawImage.data), rawImage.width, rawImage.height),
      0, 0
    );
  } else if (rawImage.channels === 1) {
    // Grayscale mask — apply to original image, capped to 1024px for output size
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = reject;
      img.src = inputUrl;  // already resized to ≤1024px
    });
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskResized =
      rawImage.width === canvas.width && rawImage.height === canvas.height
        ? rawImage
        : await rawImage.resize(canvas.width, canvas.height);
    for (let i = 0; i < maskResized.data.length; i++) {
      pixelData.data[4 * i + 3] = maskResized.data[i];
    }
    ctx.putImageData(pixelData, 0, 0);
  } else if (rawImage.channels === 3) {
    const imageData = ctx.createImageData(rawImage.width, rawImage.height);
    for (let i = 0; i < rawImage.width * rawImage.height; i++) {
      imageData.data[i * 4]     = rawImage.data[i * 3];
      imageData.data[i * 4 + 1] = rawImage.data[i * 3 + 1];
      imageData.data[i * 4 + 2] = rawImage.data[i * 3 + 2];
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  log("Background removed!");
  // WebP is smaller and faster to encode than PNG
  const webp = canvas.toDataURL("image/webp", 0.92);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
