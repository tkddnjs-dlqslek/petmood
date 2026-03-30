import {
  pipeline,
  env,
  RawImage,
  type ImageSegmentationPipeline,
  type ZeroShotImageClassificationPipeline,
} from "@huggingface/transformers";
import type { PetMoodMessage } from "../../lib/messages/protocol";
import type { ClassificationResult, ActivityType } from "../../types";

// ===== Offscreen Document Entry =====
// Full DOM + WebGPU access. Handles: background removal + zero-shot classification.

env.allowRemoteModels = true;
env.useBrowserCache = true;

// ===== Activity Classification Config =====
// 6 visually distinct classes with prompt ensembling (3-4 prompts per class)
// Averaging multiple prompts per class improves accuracy by ~5%

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

// Flatten prompts for pipeline input, with mapping back to activity
const FLAT_LABELS: string[] = [];
const LABEL_TO_ACTIVITY: Map<string, ActivityType> = new Map();

for (const [activity, prompts] of Object.entries(ACTIVITY_PROMPTS)) {
  for (const prompt of prompts) {
    FLAT_LABELS.push(prompt);
    LABEL_TO_ACTIVITY.set(prompt, activity as ActivityType);
  }
}

// Singleton model instances
let segmenter: ImageSegmentationPipeline | null = null;
let classifier: ZeroShotImageClassificationPipeline | null = null;

// ===== Message Handler =====
chrome.runtime.onMessage.addListener(
  (message: PetMoodMessage, _sender, sendResponse) => {
    if (message.type === "RUN_INFERENCE") {
      handleInference(message.payload.imageDataUrl)
        .then(sendResponse)
        .catch((err) => {
          console.error("[PetMood Offscreen] Inference error:", err);
          sendResponse({ error: String(err) });
        });
      return true;
    }
  }
);

async function handleInference(imageDataUrl: string): Promise<{
  cutoutDataUrl: string;
  classification: ClassificationResult;
}> {
  // Convert data URL to Blob for processing
  const response = await fetch(imageDataUrl);
  const imageBlob = await response.blob();

  // Step 1: Background removal
  reportProgress("bg-removal", 0, "배경 제거 중...");
  const cutoutDataUrl = await removeBackground(imageBlob);
  reportProgress("bg-removal", 100, "배경 제거 완료!");

  // Step 2: Classification (use original image data URL for context)
  reportProgress("classifying", 0, "행동 분류 중...");
  const classification = await classifyActivity(imageDataUrl);
  reportProgress("classifying", 100, "분류 완료!");

  reportProgress("done", 100, "처리 완료!");
  return { cutoutDataUrl, classification };
}

// ===== Background Removal (briaai/RMBG-1.4 via transformers.js) =====

async function getSegmenter(): Promise<ImageSegmentationPipeline> {
  if (segmenter) return segmenter;

  reportProgress("downloading", 10, "배경 제거 모델 다운로드 중... (최초 1회, ~45MB)");

  segmenter = await pipeline(
    "image-segmentation",
    "briaai/RMBG-1.4",
    { device: "wasm" }
  ) as ImageSegmentationPipeline;

  reportProgress("downloading", 50, "배경 제거 모델 준비 완료!");
  return segmenter;
}

async function removeBackground(imageBlob: Blob): Promise<string> {
  try {
    const pipe = await getSegmenter();
    const image = await RawImage.fromBlob(imageBlob);

    const results = await pipe(image as any, {
      threshold: 0.5,
      mask_threshold: 0.5,
      overlap_mask_area_threshold: 0.8,
    });

    if (!results || results.length === 0) {
      console.warn("[PetMood] Segmentation returned no results, using original");
      return blobToDataUrl(imageBlob);
    }

    // Apply mask to create transparent PNG
    const mask = results[0].mask;
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d")!;

    // Draw original image
    const imageBitmap = await createImageBitmap(imageBlob);
    ctx.drawImage(imageBitmap, 0, 0);

    // Apply mask to alpha channel
    const pixelData = ctx.getImageData(0, 0, image.width, image.height);
    const maskData = mask.data;

    for (let i = 0; i < maskData.length; i++) {
      // mask value 0-255: 255 = foreground (pet), 0 = background
      pixelData.data[4 * i + 3] = maskData[i];
    }

    ctx.putImageData(pixelData, 0, 0);

    const resultBlob = await canvas.convertToBlob({ type: "image/png" });
    return blobToDataUrl(resultBlob);
  } catch (err) {
    console.error("[PetMood] Background removal failed:", err);
    return blobToDataUrl(imageBlob);
  }
}

// ===== Classification (SigLIP zero-shot with prompt ensembling) =====

async function getClassifier(): Promise<ZeroShotImageClassificationPipeline> {
  if (classifier) return classifier;

  reportProgress("downloading", 60, "분류 모델 다운로드 중... (최초 1회, ~350MB)");

  classifier = await pipeline(
    "zero-shot-image-classification",
    "Xenova/siglip-base-patch16-224",
    { device: "wasm" }
  ) as ZeroShotImageClassificationPipeline;

  reportProgress("downloading", 100, "분류 모델 준비 완료!");
  return classifier;
}

async function classifyActivity(
  imageUrl: string
): Promise<ClassificationResult> {
  const pipe = await getClassifier();

  // Run zero-shot with all prompts (flattened)
  const results = await pipe(imageUrl, FLAT_LABELS);

  // Aggregate scores per activity (prompt ensembling = average scores per class)
  const activityScores: Record<string, number[]> = {};

  for (const result of results) {
    const activity = LABEL_TO_ACTIVITY.get(result.label);
    if (!activity) continue;
    if (!activityScores[activity]) activityScores[activity] = [];
    activityScores[activity].push(result.score);
  }

  // Average scores per activity
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

  return {
    activity: bestActivity,
    confidence: bestScore,
    allScores,
  };
}

// ===== Utilities =====

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function reportProgress(
  stage: string,
  progress: number,
  message: string
): void {
  chrome.runtime.sendMessage({
    type: "INFERENCE_PROGRESS",
    payload: { stage, progress, message },
  }).catch(() => {});
}

console.log("[PetMood Offscreen] Ready for inference (RMBG-1.4 + SigLIP)");
