import {
  pipeline,
  env,
  RawImage,
  type ZeroShotImageClassificationPipeline,
} from "@huggingface/transformers";
import type { ClassificationResult, ActivityType } from "../../types";

env.allowRemoteModels = true;
env.useBrowserCache = true;

// 6 classes with prompt ensembling
const ACTIVITY_PROMPTS: Record<ActivityType, string[]> = {
  resting: [
    "a photo of a pet sleeping on the floor",
    "a photo of a pet lying down with eyes closed",
    "a photo of a pet napping curled up",
    "a photo of a pet resting peacefully on a bed",
  ],
  eating: [
    "a photo of a pet eating food from a bowl",
    "a photo of a pet with its face in a food dish",
    "a photo of a pet chewing on food or a treat",
  ],
  active: [
    "a photo of a pet running and playing outside",
    "a photo of a pet jumping excitedly",
    "a photo of a pet playing with a toy",
    "a photo of a pet moving quickly and energetically",
  ],
  alert: [
    "a photo of a pet sitting upright looking at the camera",
    "a photo of a pet standing and looking around attentively",
    "a photo of an attentive pet with ears perked up",
    "a photo of a pet posing and looking directly at the viewer",
  ],
  relaxing: [
    "a photo of a pet lying down comfortably with eyes open",
    "a photo of a pet lounging lazily on a couch",
    "a photo of a pet resting with a calm expression",
  ],
  yawning: [
    "a photo of a pet yawning with mouth wide open",
    "a photo of a pet stretching its body and yawning",
    "a photo of a pet opening its mouth very wide",
  ],
};

const FLAT_LABELS: string[] = [];
const LABEL_TO_ACTIVITY: Map<string, ActivityType> = new Map();

for (const [activity, prompts] of Object.entries(ACTIVITY_PROMPTS)) {
  for (const prompt of prompts) {
    FLAT_LABELS.push(prompt);
    LABEL_TO_ACTIVITY.set(prompt, activity as ActivityType);
  }
}

let bgRemover: any = null;
let classifier: ZeroShotImageClassificationPipeline | null = null;

// ===== Public API =====

export async function processPhoto(
  imageDataUrl: string,
  onProgress?: (message: string) => void
): Promise<{
  cutoutDataUrl: string;
  classification: ClassificationResult;
  errors: string[];
}> {
  const log = onProgress ?? ((msg: string) => console.log("[PetMood]", msg));
  const errors: string[] = [];

  // Step 1: Background removal
  let cutoutDataUrl = imageDataUrl;
  try {
    log("배경 제거 시작...");
    cutoutDataUrl = await removeBackground(imageDataUrl, log);
    if (cutoutDataUrl === imageDataUrl) {
      log("⚠️ 배경 제거 결과가 원본과 동일 — 모델 출력 확인 필요");
    } else {
      log("✅ 배경 제거 완료!");
    }
  } catch (err: any) {
    const errMsg = `누끼 실패: ${err?.message ?? err}`;
    console.error("[PetMood]", errMsg, err);
    errors.push(errMsg);
    log(`❌ ${errMsg}`);
  }

  // Step 2: Classification
  let classification: ClassificationResult = {
    activity: "alert",
    confidence: 0,
    allScores: {} as any,
  };
  try {
    log("분류 시작...");
    classification = await classifyActivity(imageDataUrl, log);
    log(`✅ 분류: ${classification.activity} (${(classification.confidence * 100).toFixed(0)}%)`);
  } catch (err: any) {
    const errMsg = `분류 실패: ${err?.message ?? err}`;
    console.error("[PetMood]", errMsg, err);
    errors.push(errMsg);
    log(`❌ ${errMsg}`);
  }

  return { cutoutDataUrl, classification, errors };
}

// ===== Background Removal =====

async function removeBackground(
  imageDataUrl: string,
  log: (msg: string) => void
): Promise<string> {
  if (!bgRemover) {
    log("배경 제거 모델 다운로드 중... (최초 1회, ~45MB)");
    bgRemover = await pipeline("background-removal", "briaai/RMBG-1.4", {
      device: "wasm",
    });
    log("배경 제거 모델 로드 완료!");
  }

  log("배경 분석 중...");
  const output = await bgRemover(imageDataUrl);

  // Debug: log what the pipeline actually returns
  console.log("[PetMood] bgRemover output type:", typeof output);
  console.log("[PetMood] bgRemover output:", output);
  console.log("[PetMood] is RawImage?", output instanceof RawImage);
  console.log("[PetMood] is Array?", Array.isArray(output));

  if (Array.isArray(output)) {
    console.log("[PetMood] array length:", output.length);
    console.log("[PetMood] first element:", output[0]);
    console.log("[PetMood] first element type:", typeof output[0]);
    if (output[0] instanceof RawImage) {
      console.log("[PetMood] first element is RawImage, channels:", output[0].channels);
    }
  }

  // Try to extract the RawImage from various possible output formats
  let rawImage: any = null;

  if (output instanceof RawImage) {
    rawImage = output;
  } else if (Array.isArray(output) && output.length > 0) {
    if (output[0] instanceof RawImage) {
      rawImage = output[0];
    } else if (output[0]?.mask instanceof RawImage) {
      rawImage = output[0].mask;
    } else if (typeof output[0] === "object" && output[0] !== null) {
      // Log all keys to understand structure
      console.log("[PetMood] output[0] keys:", Object.keys(output[0]));
      // Try common keys
      for (const key of ["mask", "image", "output", "data"]) {
        if (output[0][key] instanceof RawImage) {
          rawImage = output[0][key];
          console.log("[PetMood] found RawImage at key:", key);
          break;
        }
      }
    }
  }

  if (!rawImage) {
    console.error("[PetMood] Could not extract RawImage from output. Using original.");
    log("⚠️ 배경 제거 출력 형식 인식 불가 — 원본 사용");
    return imageDataUrl;
  }

  console.log("[PetMood] RawImage size:", rawImage.width, "x", rawImage.height);
  console.log("[PetMood] RawImage channels:", rawImage.channels);
  console.log("[PetMood] RawImage data length:", rawImage.data?.length);

  // Convert RawImage to data URL
  // RawImage has .toCanvas() method or we use raw data
  try {
    // Method 1: Try toCanvas if available
    if (typeof rawImage.toCanvas === "function") {
      const canvas = rawImage.toCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      console.log("[PetMood] Used toCanvas method");
      return dataUrl;
    }
  } catch (e) {
    console.warn("[PetMood] toCanvas failed:", e);
  }

  try {
    // Method 2: Manual canvas drawing
    const canvas = document.createElement("canvas");
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    const ctx = canvas.getContext("2d")!;

    if (rawImage.channels === 4) {
      // RGBA data
      const imageData = new ImageData(
        new Uint8ClampedArray(rawImage.data),
        rawImage.width,
        rawImage.height
      );
      ctx.putImageData(imageData, 0, 0);
    } else if (rawImage.channels === 1) {
      // Grayscale mask — apply to original image
      log("마스크 적용 중...");
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
      // Resize mask if needed
      const maskResized =
        rawImage.width === canvas.width && rawImage.height === canvas.height
          ? rawImage
          : await rawImage.resize(canvas.width, canvas.height);

      for (let i = 0; i < maskResized.data.length; i++) {
        pixelData.data[4 * i + 3] = maskResized.data[i];
      }
      ctx.putImageData(pixelData, 0, 0);
    } else if (rawImage.channels === 3) {
      // RGB without alpha — probably the cutout with white background
      const imageData = ctx.createImageData(rawImage.width, rawImage.height);
      for (let i = 0; i < rawImage.width * rawImage.height; i++) {
        imageData.data[i * 4] = rawImage.data[i * 3];
        imageData.data[i * 4 + 1] = rawImage.data[i * 3 + 1];
        imageData.data[i * 4 + 2] = rawImage.data[i * 3 + 2];
        imageData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const dataUrl = canvas.toDataURL("image/png");
    console.log("[PetMood] Manual canvas conversion done, dataUrl length:", dataUrl.length);
    return dataUrl;
  } catch (e) {
    console.error("[PetMood] Canvas conversion failed:", e);
    return imageDataUrl;
  }
}

// ===== Classification =====

async function classifyActivity(
  imageDataUrl: string,
  log: (msg: string) => void
): Promise<ClassificationResult> {
  if (!classifier) {
    log("분류 모델 다운로드 중... (최초 1회)");
    classifier = (await pipeline(
      "zero-shot-image-classification",
      "Xenova/clip-vit-base-patch32",
      { device: "wasm" }
    )) as ZeroShotImageClassificationPipeline;
    log("분류 모델 준비 완료!");
  }

  const results = await classifier(imageDataUrl, FLAT_LABELS);

  const activityScores: Record<string, number[]> = {};
  for (const result of results) {
    const activity = LABEL_TO_ACTIVITY.get(result.label);
    if (!activity) continue;
    if (!activityScores[activity]) activityScores[activity] = [];
    activityScores[activity].push(result.score);
  }

  const allScores = {} as Record<ActivityType, number>;
  let bestActivity: ActivityType = "alert";
  let bestScore = 0;

  for (const [activity, scores] of Object.entries(activityScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    allScores[activity as ActivityType] = avg;
    if (avg > bestScore) {
      bestScore = avg;
      bestActivity = activity as ActivityType;
    }
  }

  return { activity: bestActivity, confidence: bestScore, allScores };
}
