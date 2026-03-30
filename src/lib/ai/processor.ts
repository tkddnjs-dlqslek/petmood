import {
  pipeline,
  env,
  type ZeroShotImageClassificationPipeline,
} from "@huggingface/transformers";
import type { ClassificationResult, ActivityType } from "../../types";

// ===== AI Processor =====
// Runs directly in Options Page.

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
  const log = onProgress ?? console.log;
  const errors: string[] = [];

  // Step 1: Background removal
  let cutoutDataUrl = imageDataUrl; // fallback = original
  try {
    log("배경 제거 모델 준비 중...");
    cutoutDataUrl = await removeBackground(imageDataUrl, log);
    log("배경 제거 완료!");
  } catch (err: any) {
    const errMsg = `누끼 실패: ${err?.message ?? err}`;
    console.error("[PetMood]", errMsg, err);
    errors.push(errMsg);
    log(`배경 제거 실패 — 원본 사용 (${errMsg})`);
  }

  // Step 2: Classification
  let classification: ClassificationResult = {
    activity: "alert",
    confidence: 0,
    allScores: {} as any,
  };
  try {
    log("분류 모델 준비 중...");
    classification = await classifyActivity(imageDataUrl, log);
    log(`분류 완료: ${classification.activity} (${(classification.confidence * 100).toFixed(0)}%)`);
  } catch (err: any) {
    const errMsg = `분류 실패: ${err?.message ?? err}`;
    console.error("[PetMood]", errMsg, err);
    errors.push(errMsg);
    log(`분류 실패 — 기본값 사용 (${errMsg})`);
  }

  return { cutoutDataUrl, classification, errors };
}

// ===== Background Removal =====
// Use "background-removal" task (transformers.js v3.4+)
// Returns RawImage with transparency already applied

async function removeBackground(
  imageDataUrl: string,
  log: (msg: string) => void
): Promise<string> {
  if (!bgRemover) {
    log("배경 제거 모델 다운로드 중... (최초 1회, ~45MB)");
    bgRemover = await pipeline("background-removal", "briaai/RMBG-1.4", {
      device: "wasm",
    });
    log("배경 제거 모델 준비 완료!");
  }

  log("배경 분석 중...");
  const output = await bgRemover(imageDataUrl);

  // output is a RawImage — convert to data URL via canvas
  const rawImage = output;
  const canvas = document.createElement("canvas");
  canvas.width = rawImage.width;
  canvas.height = rawImage.height;
  const ctx = canvas.getContext("2d")!;

  // RawImage has .toCanvas() or we can use ImageData
  const imageData = new ImageData(
    new Uint8ClampedArray(rawImage.data),
    rawImage.width,
    rawImage.height
  );
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
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
}
