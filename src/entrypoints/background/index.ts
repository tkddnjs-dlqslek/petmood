import { settingsStore } from "../../lib/storage/settings-store";
import { photoDB } from "../../lib/storage/photo-db";
import {
  selectMessage,
  getTimeContext,
  suggestActivity,
} from "../../lib/templates/selector";
import type { PetMoodMessage } from "../../lib/messages/protocol";
import { sendToTab } from "../../lib/messages/protocol";
import type { NotificationPayload } from "../../types";

export default defineBackground(() => {
  const ALARM_NAME = "petmood-tick";
  const GLOBAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // ===== Alarm Setup =====
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await evaluateAndNotify();
  });

  // ===== Browse Duration Tracking =====
  chrome.tabs.onActivated.addListener(async () => {
    const settings = await settingsStore.get();
    if (settings.browsingStartTimestamp === 0) {
      await settingsStore.set({ browsingStartTimestamp: Date.now() });
    }
  });

  chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === "active") {
      await settingsStore.set({ browsingStartTimestamp: Date.now() });
    }
  });

  // ===== Message Handler =====
  chrome.runtime.onMessage.addListener(
    (message: PetMoodMessage, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true; // Keep channel open for async response
    }
  );

  async function handleMessage(message: PetMoodMessage): Promise<unknown> {
    switch (message.type) {
      case "PROCESS_PHOTO":
        return processPhoto(message.payload);
      case "TOGGLE_ENABLED":
        await settingsStore.set({ isEnabled: message.payload.enabled });
        return { success: true };
      case "CORRECT_CLASSIFICATION":
        await photoDB.updateActivity(
          message.payload.photoId,
          message.payload.activity
        );
        return { success: true };
      case "DELETE_PHOTO":
        await photoDB.deletePhoto(message.payload.photoId);
        return { success: true };
      case "NOTIFICATION_DISMISSED":
        return { success: true };
      // Ignore messages meant for offscreen document or progress updates
      case "RUN_INFERENCE":
      case "INFERENCE_PROGRESS":
      case "INFERENCE_RESULT":
      case "INFERENCE_ERROR":
        return undefined;
      default:
        return undefined;
    }
  }

  // ===== Photo Processing =====
  async function processPhoto(payload: {
    imageArrayBuffer: ArrayBuffer;
    fileName: string;
  }): Promise<unknown> {
    try {
      // Ensure offscreen document exists
      await ensureOffscreen();

      // Send to offscreen for inference
      const response = await chrome.runtime.sendMessage({
        type: "RUN_INFERENCE",
        payload: { imageArrayBuffer: payload.imageArrayBuffer },
      });

      return response;
    } catch (error) {
      console.error("[PetMood] Photo processing error:", error);
      return { error: String(error) };
    }
  }

  async function ensureOffscreen(): Promise<void> {
    const existing = await chrome.offscreen.hasDocument?.();
    if (existing) return;

    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "AI model inference for pet photo classification",
    });
  }

  // ===== Trigger Evaluation =====
  async function evaluateAndNotify(): Promise<void> {
    const settings = await settingsStore.get();

    if (!settings.isEnabled || !settings.onboardingCompleted) return;

    // Active hours check
    if (settings.activeHours.enabled) {
      const hour = new Date().getHours();
      const { startHour, endHour } = settings.activeHours;
      if (startHour < endHour) {
        if (hour < startHour || hour >= endHour) return;
      } else {
        if (hour < startHour && hour >= endHour) return;
      }
    }

    // Global cooldown
    if (Date.now() - settings.lastNotificationTimestamp < GLOBAL_COOLDOWN_MS)
      return;

    const now = new Date();
    const hour = now.getHours();
    const timeCtx = getTimeContext(hour);
    let triggerFired = false;
    let triggerType: "timer" | "time-of-day" | "browse-duration" = "timer";
    let hintedActivity: string | undefined;

    // 1. Browse duration (highest priority)
    if (settings.triggers.browseDuration.enabled) {
      const elapsed =
        (Date.now() - settings.browsingStartTimestamp) / 60000;
      if (elapsed >= settings.triggers.browseDuration.thresholdMinutes) {
        triggerFired = true;
        triggerType = "browse-duration";
      }
    }

    // 2. Time-of-day
    if (!triggerFired && settings.triggers.timeOfDay.enabled) {
      for (const slot of settings.triggers.timeOfDay.slots) {
        if (
          hour === slot.hour &&
          now.getMinutes() >= slot.minute &&
          now.getMinutes() < slot.minute + 5 &&
          !slot.firedToday
        ) {
          triggerFired = true;
          triggerType = "time-of-day";
          hintedActivity = slot.activityHint;
          // Mark as fired today
          slot.firedToday = true;
          await settingsStore.set({ triggers: settings.triggers });
          break;
        }
      }
    }

    // 3. Timer
    if (!triggerFired && settings.triggers.timer.enabled) {
      const elapsed =
        Date.now() - settings.lastNotificationTimestamp;
      if (elapsed >= settings.triggers.timer.intervalMinutes * 60 * 1000) {
        triggerFired = true;
        triggerType = "timer";
      }
    }

    if (!triggerFired) return;

    // Pick activity and photo
    const activity =
      hintedActivity ?? suggestActivity(timeCtx, triggerType);
    const photo = await photoDB.getRandomPhoto(activity as any);
    if (!photo) {
      // Try any photo
      const anyPhoto = await photoDB.getRandomPhoto();
      if (!anyPhoto) return; // No photos uploaded yet
      await showNotification(anyPhoto.cutoutDataUrl, anyPhoto.activity, triggerType, settings);
      return;
    }

    await showNotification(photo.cutoutDataUrl, activity as any, triggerType, settings);
  }

  async function showNotification(
    imageDataUrl: string,
    activity: string,
    triggerType: "timer" | "time-of-day" | "browse-duration",
    settings: Awaited<ReturnType<typeof settingsStore.get>>
  ): Promise<void> {
    const hour = new Date().getHours();
    const { id, text } = selectMessage({
      activity: activity as any,
      triggerType,
      currentHour: hour,
      userName: settings.userName,
      petName: settings.petName,
      recentMessageIds: settings.recentMessageIds,
    });

    // Decide display type
    const displayType =
      settings.display.showRunningAnimation &&
      activity === "active" &&
      Math.random() > 0.5
        ? "running"
        : "card";

    const payload: NotificationPayload = {
      imageDataUrl,
      message: text,
      displayType: displayType as any,
      position: settings.display.position,
      durationSeconds: settings.display.displayDurationSeconds,
    };

    // Send to active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    try {
      await sendToTab(tab.id, {
        type: "SHOW_NOTIFICATION",
        payload,
      });
    } catch {
      // Content script not injected on this page
    }

    // Update state
    const recentIds = [...settings.recentMessageIds, id].slice(-10);
    await settingsStore.set({
      lastNotificationTimestamp: Date.now(),
      totalNotificationsShown: settings.totalNotificationsShown + 1,
      recentMessageIds: recentIds,
      browsingStartTimestamp: Date.now(), // Reset browse timer
    });
  }

  // Reset time-of-day fired flags at midnight
  chrome.alarms.create("petmood-daily-reset", {
    periodInMinutes: 60,
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "petmood-daily-reset") return;
    const hour = new Date().getHours();
    if (hour !== 0) return;

    const settings = await settingsStore.get();
    const slots = settings.triggers.timeOfDay.slots.map((s) => ({
      ...s,
      firedToday: false,
    }));
    await settingsStore.set({
      triggers: {
        ...settings.triggers,
        timeOfDay: { ...settings.triggers.timeOfDay, slots },
      },
    });
  });
});
