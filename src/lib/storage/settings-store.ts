import type { PetMoodSettings } from "../../types";

const DEFAULT_SETTINGS: PetMoodSettings = {
  userName: "",
  petName: "",
  isEnabled: false,
  onboardingCompleted: false,

  triggers: {
    timer: {
      enabled: true,
      intervalMinutes: 10,
    },
  },

  frequencyPreset: "lively",
};

const STORAGE_KEY = "petmood_settings";

export const settingsStore = {
  async get(): Promise<PetMoodSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (!stored) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...stored };
  },

  async set(settings: Partial<PetMoodSettings>): Promise<void> {
    const current = await this.get();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  },

  async update(
    updater: (current: PetMoodSettings) => Partial<PetMoodSettings>
  ): Promise<PetMoodSettings> {
    const current = await this.get();
    const updates = updater(current);
    const merged = { ...current, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEY]: merged });
    return merged;
  },

  onChange(callback: (settings: PetMoodSettings) => void): () => void {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if (changes[STORAGE_KEY]) {
        callback({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<PetMoodSettings>) });
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  },
};
