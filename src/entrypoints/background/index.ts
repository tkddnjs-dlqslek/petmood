import { settingsStore } from "../../lib/storage/settings-store";
import { dispatchNotification } from "../../lib/test-animation";
import type { StoredPhotoMeta } from "../../types";

const STORAGE_KEY = "petmood_settings";

export default defineBackground(() => {
  const ALARM_NAME = "petmood-tick";
  // Background-owned meta cache. Service workers can be evicted, so this
  // re-warms automatically on the next call.
  const photosCache: { current: StoredPhotoMeta[] | null } = { current: null };

  /**
   * The alarm IS the timer: it fires once per the user's interval. We only
   * (re)create it when missing or when the interval changed — NOT on every
   * service-worker spin-up, because chrome.alarms.create re-anchors the
   * countdown to "now", and a frequently-evicted SW would otherwise keep
   * resetting it so it never fires.
   */
  async function syncAlarm(): Promise<void> {
    const settings = await settingsStore.get();
    const minutes = Math.max(1, settings.triggers.timer.intervalMinutes);
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (existing && existing.periodInMinutes === minutes) return;
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
  }

  syncAlarm();
  chrome.runtime.onInstalled.addListener(syncAlarm);
  chrome.runtime.onStartup.addListener(syncAlarm);

  // Recreate the alarm only when the interval actually changes.
  chrome.storage.onChanged.addListener((changes) => {
    const c = changes[STORAGE_KEY];
    if (!c) return;
    const oldMin = (c.oldValue as { triggers?: { timer?: { intervalMinutes?: number } } } | undefined)
      ?.triggers?.timer?.intervalMinutes;
    const newMin = (c.newValue as { triggers?: { timer?: { intervalMinutes?: number } } } | undefined)
      ?.triggers?.timer?.intervalMinutes;
    if (oldMin !== newMin) syncAlarm();
  });

  // Alarm fires → send a notification (gated by the on/off toggle inside dispatch).
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    const settings = await settingsStore.get();
    if (!settings.isEnabled || !settings.onboardingCompleted) return;

    await dispatchNotification({
      settings,
      requested: "random",
      enforcePolicy: true,
      photosCache,
    });
  });
});
