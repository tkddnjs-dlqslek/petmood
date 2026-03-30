import type {
  NotificationPayload,
  ProcessingProgress,
  ClassificationResult,
  ActivityType,
} from "../../types";

// ===== Message Types =====

// Options/Popup → Service Worker
export type ProcessPhotoMessage = {
  type: "PROCESS_PHOTO";
  payload: {
    imageArrayBuffer: ArrayBuffer;
    fileName: string;
  };
};

export type UpdateSettingsMessage = {
  type: "UPDATE_SETTINGS";
  payload: Record<string, unknown>;
};

export type ToggleEnabledMessage = {
  type: "TOGGLE_ENABLED";
  payload: { enabled: boolean };
};

export type CorrectClassificationMessage = {
  type: "CORRECT_CLASSIFICATION";
  payload: { photoId: string; activity: ActivityType };
};

export type DeletePhotoMessage = {
  type: "DELETE_PHOTO";
  payload: { photoId: string };
};

// Service Worker → Offscreen
export type RunInferenceMessage = {
  type: "RUN_INFERENCE";
  payload: {
    imageArrayBuffer: ArrayBuffer;
  };
};

// Offscreen → Service Worker
export type InferenceResultMessage = {
  type: "INFERENCE_RESULT";
  payload: {
    cutoutBlob: Blob;
    cutoutDataUrl: string;
    classification: ClassificationResult;
  };
};

export type InferenceProgressMessage = {
  type: "INFERENCE_PROGRESS";
  payload: ProcessingProgress;
};

export type InferenceErrorMessage = {
  type: "INFERENCE_ERROR";
  payload: { error: string };
};

// Service Worker → Content Script
export type ShowNotificationMessage = {
  type: "SHOW_NOTIFICATION";
  payload: NotificationPayload;
};

export type DismissNotificationMessage = {
  type: "DISMISS_NOTIFICATION";
};

// Content Script → Service Worker
export type NotificationDismissedMessage = {
  type: "NOTIFICATION_DISMISSED";
};

// All possible messages
export type PetMoodMessage =
  | ProcessPhotoMessage
  | UpdateSettingsMessage
  | ToggleEnabledMessage
  | CorrectClassificationMessage
  | DeletePhotoMessage
  | RunInferenceMessage
  | InferenceResultMessage
  | InferenceProgressMessage
  | InferenceErrorMessage
  | ShowNotificationMessage
  | DismissNotificationMessage
  | NotificationDismissedMessage;

// ===== Helper Functions =====

export function sendToBackground(message: PetMoodMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function sendToTab(
  tabId: number,
  message: PetMoodMessage
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}
