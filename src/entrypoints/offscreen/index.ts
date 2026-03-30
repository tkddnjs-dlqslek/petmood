import { pipeline, env, type ZeroShotImageClassificationPipeline } from "@huggingface/transformers";
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";
import type { PetMoodMessage } from "../../lib/messages/protocol";
import type { ClassificationResult, ActivityType } from "../../types";
import { ACTIVITY_TYPES } from "../../types";

// ===== Offscreen Document Entry =====
// Full DOM + WebGPU access. Handles: background removal + zero-shot classification.

// Configure transformers.js: use Cache API for model storage, allow remote models
env.allowRemoteModels = true;
env.useBrowserCache = true;

// Zero-shot classification labels
const ACTIVITY_LABELS: string[] = [
  "a pet sleeping peacefully",
  "a pet eating food from a bowl",
  "a pet running or moving fast",
  "a pet yawning with mouth wide open",
  "a pet playing with a toy or another animal",
  "a pet sitting upright calmly",
  "a pet lying down and relaxing",
  "a pet standing on all four legs",
  "a pet tilting its head curiously",
  "a pet stretching its body",
];

// Singleton classifier instance
let classifier: ZeroShotImageClassificationPipeline | null = null;

// ===== Message Handler =====
chrome.runtime.onMessage.addListener(
  (message: PetMoodMessage, _sender, sendResponse) => {
    if (message.type === "RUN_INFERENCE") {
      handleInference(message.payload.imageArrayBuffer)
        .then(sendResponse)
        .catch((err) => {
          console.error("[PetMood Offscreen] Inference error:", err);
          sendResponse({ error: String(err) });
        });
      return true;
    }
  }
);

async function handleInference(imageArrayBuffer: ArrayBuffer): Promise<{
  cutoutDataUrl: string;
  classification: ClassificationResult;
}> {
  // Run background removal and classification in parallel for speed
  reportProgress("downloading", 0, "AI 모델 준비 중...");

  const imageBlob = new Blob([imageArrayBuffer], { type: "image/png" });
  const imageUrl = URL.createObjectURL(imageBlob);

  try {
    // Step 1: Background removal
    reportProgress("bg-removal", 0, "배경 제거 중...");
    const cutoutDataUrl = await removeBackground(imageBlob);
    reportProgress("bg-removal", 100, "배경 제거 완료!");

    // Step 2: Classification (use original image for better accuracy)
    reportProgress("classifying", 0, "행동 분류 중...");
    const classification = await classifyActivity(imageUrl);
    reportProgress("classifying", 100, "분류 완료!");

    reportProgress("done", 100, "처리 완료!");
    return { cutoutDataUrl, classification };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

// ===== Background Removal (@imgly/background-removal) =====

async function removeBackground(imageBlob: Blob): Promise<string> {
  try {
    const resultBlob = await imglyRemoveBackground(imageBlob, {
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          reportProgress(
            "bg-removal",
            Math.round((current / total) * 100),
            `배경 제거 중... (${key})`
          );
        }
      },
    });
    return blobToDataUrl(resultBlob);
  } catch (err) {
    console.warn("[PetMood] Background removal failed, using original:", err);
    return blobToDataUrl(imageBlob);
  }
}

// ===== Classification (MobileCLIP-S0 zero-shot via transformers.js) =====

async function getClassifier(): Promise<ZeroShotImageClassificationPipeline> {
  if (classifier) return classifier;

  reportProgress("downloading", 10, "분류 모델 다운로드 중... (최초 1회, ~55MB)");

  classifier = await pipeline(
    "zero-shot-image-classification",
    "Xenova/mobileclip_s0",
    {
      dtype: "q8", // int8 quantized: ~55MB total
      device: "wasm", // WASM is most reliable; WebGPU can be tried later
    },
  ) as ZeroShotImageClassificationPipeline;

  reportProgress("downloading", 100, "분류 모델 준비 완료!");
  return classifier;
}

async function classifyActivity(
  imageUrl: string
): Promise<ClassificationResult> {
  const pipe = await getClassifier();

  // Run zero-shot classification
  const results = await pipe(imageUrl, ACTIVITY_LABELS);

  // Map results back to ActivityType
  const allScores = {} as Record<ActivityType, number>;
  let bestActivity: ActivityType = "sitting";
  let bestScore = 0;

  for (const result of results) {
    const labelIndex = ACTIVITY_LABELS.indexOf(result.label);
    if (labelIndex >= 0 && labelIndex < ACTIVITY_TYPES.length) {
      const activity = ACTIVITY_TYPES[labelIndex];
      allScores[activity] = result.score;
      if (result.score > bestScore) {
        bestScore = result.score;
        bestActivity = activity;
      }
    }
  }

  // Fill in any missing scores
  for (const a of ACTIVITY_TYPES) {
    if (!(a in allScores)) allScores[a] = 0;
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
  }).catch(() => {
    // Ignore if no listener
  });
}

console.log("[PetMood Offscreen] Ready for inference");
