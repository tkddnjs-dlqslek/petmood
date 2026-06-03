// ===== Pet & Display Types =====
export type DisplayType =
  | "stampede"
  | "rain"
  | "parade"
  | "peekaboo"
  | "bounce"
  | "popcorn"
  | "carousel"
  | "float"
  | "tornado"
  | "photoBooth"
  | "teleport"
  | "dominoFall"
  | "trampoline"
  | "bowling"
  | "fireworks"
  | "kiss"
  | "rainbowArc"
  | "danceParty";

// ===== Settings =====
export interface PetMoodSettings {
  userName: string;
  petName: string;
  isEnabled: boolean;
  onboardingCompleted: boolean;

  triggers: {
    timer: {
      enabled: boolean;
      intervalMinutes: number;
    };
  };

  frequencyPreset: "quiet" | "normal" | "lively" | "custom";
}

// ===== IndexedDB Types =====

export interface StoredPhotoMeta {
  id: string;
  originalBlob: Blob;
  thumbnailDataUrl: string;
  createdAt: number;
  // Pre-v3 records may still carry the cutout inline. Reads fall back to this.
  cutoutDataUrl?: string;
}

export interface StoredPhoto extends StoredPhotoMeta {
  cutoutDataUrl: string;
}

// ===== Notification Types =====
export interface NotificationPayload {
  imageDataUrl: string;
  displayType: DisplayType;
  swarmImageUrls: string[];
}
