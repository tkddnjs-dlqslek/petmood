import {
  pipeline,
  env,
  RawImage,
  type ImageSegmentationPipeline,
  type ZeroShotImageClassificationPipeline,
} from "@huggingface/transformers";
import type { ClassificationResult, ActivityType } from "../../types";

// ===== AI Processor =====
// Runs directly in Options Page (has full DOM + Canvas access).
// No need for offscreen document or message passing.

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

let segmenter: ImageSegmentationPipeline | null = null;
let classifier: ZeroShotImageClassificationPipeline | null = null;

// ===== Public API =====

export async function processPhoto(
  imageDataUrl: string,
  onProgress?: (message: string) => void
): Promise<{
  cutoutDataUrl: string;
  classification: ClassificationResult;
}> {
  const log = onProgress ?? console.log;

  // Convert data URL to Blob
  const response = await fetch(imageDataUrl);
  const imageBlob = await response.blob();

  // Step 1: Background removal
  log("배경 제거 중...");
  const cutoutDataUrl = await removeBackground(imageBlob, log);

  // Step 2: Classification
  log("행동 분류 중...");
  const classification = await classifyActivity(imageDataUrl, log);

  log("처리 완료!");
  return { cutoutDataUrl, classification };
}

// ===== Background Removal =====

async function removeBackground(
  imageBlob: Blob,
  log: (msg: string) => void
): Promise<string> {
  try {
    if (!segmenter) {
      log("배경 제거 모델 다운로드 중... (최초 1회, ~45MB)");
      segmenter = (await pipeline("image-segmentation", "briaai/RMBG-1.4", {
        device: "wasm",
      })) as ImageSegmentationPipeline;
      log("배경 제거 모델 준비 완료!");
    }

    const image = await RawImage.fromBlob(imageBlob);
    log("배경 분석 중...");

    const results = await segmenter(image as any);

    if (!results || results.length === 0) {
      console.warn("[PetMood] No segmentation results");
      return blobToDataUrl(imageBlob);
    }

    // Apply mask to create transparent PNG
    const mask = results[0].mask;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;

    // Draw original image
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = URL.createObjectURL(imageBlob);
    });
    ctx.drawImage(img, 0, 0, image.width, image.height);
    URL.revokeObjectURL(img.src);

    // Apply mask to alpha channel
    const pixelData = ctx.getImageData(0, 0, image.width, image.height);
    const maskData = mask.data;

    for (let i = 0; i < maskData.length; i++) {
      pixelData.data[4 * i + 3] = maskData[i];
    }

    ctx.putImageData(pixelData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("[PetMood] Background removal failed:", err);
    return blobToDataUrl(imageBlob);
  }
}

// ===== Classification =====

async function classifyActivity(
  imageDataUrl: string,
  log: (msg: string) => void
): Promise<ClassificationResult> {
  try {
    if (!classifier) {
      log("분류 모델 다운로드 중... (최초 1회, ~350MB)");
      classifier = (await pipeline(
        "zero-shot-image-classification",
        "Xenova/siglip-base-patch16-224",
        { device: "wasm" }
      )) as ZeroShotImageClassificationPipeline;
      log("분류 모델 준비 완료!");
    }

    const results = await classifier(imageDataUrl, FLAT_LABELS);

    // Aggregate via prompt ensembling
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
  } catch (err) {
    console.error("[PetMood] Classification failed:", err);
    return { activity: "alert", confidence: 0, allScores: {} as any };
  }
}

// ===== Utility =====

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
