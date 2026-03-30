import {
  pipeline,
  env,
  RawImage,
} from "@huggingface/transformers";

// Configure for Chrome Extension
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("/");
env.allowLocalModels = false;

let bgRemover: any = null;

/**
 * Remove background from image (누끼).
 * Returns transparent PNG as data URL.
 */
export async function removeBackgroundFromImage(
  imageDataUrl: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const log = onProgress ?? ((msg: string) => console.log("[PetMood]", msg));

  if (!bgRemover) {
    log("배경 제거 모델 다운로드 중... (최초 1회)");
    bgRemover = await pipeline("background-removal", "briaai/RMBG-1.4", {
      device: "wasm",
    });
    log("배경 제거 모델 준비 완료!");
  }

  log("배경 제거 중...");
  const output = await bgRemover(imageDataUrl, { threshold: 0.8 });

  // Extract RawImage
  let rawImage: any = null;
  if (output instanceof RawImage) {
    rawImage = output;
  } else if (Array.isArray(output) && output.length > 0) {
    rawImage = output[0] instanceof RawImage ? output[0] : output[0]?.mask;
  }

  if (!rawImage) {
    console.warn("[PetMood] 배경 제거 출력 인식 불가");
    return imageDataUrl;
  }

  // Convert RawImage to transparent PNG via canvas
  const canvas = document.createElement("canvas");
  canvas.width = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext("2d")!;

  if (rawImage.channels === 4) {
    const imageData = new ImageData(
      new Uint8ClampedArray(rawImage.data),
      rawImage.width,
      rawImage.height
    );
    ctx.putImageData(imageData, 0, 0);
  } else if (rawImage.channels === 1) {
    // Grayscale mask — apply to original image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageDataUrl;
    });
    canvas.width = img.naturalWidth;
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
      imageData.data[i * 4] = rawImage.data[i * 3];
      imageData.data[i * 4 + 1] = rawImage.data[i * 3 + 1];
      imageData.data[i * 4 + 2] = rawImage.data[i * 3 + 2];
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  log("배경 제거 완료!");
  return canvas.toDataURL("image/png");
}
