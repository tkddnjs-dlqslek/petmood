// ===== Activity Types =====
export const ACTIVITY_TYPES = [
  "happy",      // 웃는
  "eating",     // 먹는
  "running",    // 뛰는
  "sleeping",   // 자는
  "sad",        // 슬픔
  "angry",      // 화남
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type PetType = "dog" | "cat";

export type TimeContext = "morning" | "afternoon" | "evening" | "night";

export type TriggerType = "timer" | "time-of-day" | "browse-duration";

export type NotificationPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left";

export type DisplayType = "bounce" | "peek" | "running" | "float" | "wobble" | "spin";

// ===== Storage Types =====
export interface PetMoodSettings {
  userName: string;
  petName: string;
  petType: PetType;
  isEnabled: boolean;
  onboardingCompleted: boolean;

  triggers: {
    timer: {
      enabled: boolean;
      intervalMinutes: number;
    };
    timeOfDay: {
      enabled: boolean;
      slots: TimeSlot[];
    };
    browseDuration: {
      enabled: boolean;
      thresholdMinutes: number;
    };
  };

  display: {
    position: NotificationPosition;
    showRunningAnimation: boolean;
    displayDurationSeconds: number;
    soundEnabled: boolean;
  };

  activeHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };

  models: {
    classifierReady: boolean;
    bgRemoverReady: boolean;
  };

  lastNotificationTimestamp: number;
  browsingStartTimestamp: number;
  totalNotificationsShown: number;
  recentMessageIds: string[];
}

export interface TimeSlot {
  hour: number;
  minute: number;
  activityHint?: ActivityType;
  firedToday?: boolean;
}

// ===== IndexedDB Types =====
export interface StoredPhoto {
  id: string;
  originalBlob: Blob;
  cutoutBlob: Blob;
  cutoutDataUrl: string;
  thumbnailDataUrl: string;
  activity: ActivityType;
  confidence: number;
  userCorrected: boolean;
  petType: PetType;
  createdAt: number;
}

export interface CachedModel {
  id: string;
  blob: Blob;
  version: string;
  downloadedAt: number;
}

// ===== Notification Types =====
export interface NotificationPayload {
  imageDataUrl: string;
  message: string;
  displayType: DisplayType;
  position: NotificationPosition;
  durationSeconds: number;
}

// ===== Trigger Types =====
export interface TriggerResult {
  shouldNotify: boolean;
  reason: TriggerType;
  suggestedActivity?: ActivityType;
  priority: number;
}

// ===== Processing Types =====
export interface ProcessingProgress {
  stage: "downloading" | "bg-removal" | "classifying" | "saving" | "done";
  progress: number; // 0-100
  message: string;
}

export interface ClassificationResult {
  activity: ActivityType;
  confidence: number;
  allScores: Record<ActivityType, number>;
}
