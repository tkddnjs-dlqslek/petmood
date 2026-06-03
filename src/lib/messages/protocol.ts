import type { NotificationPayload } from "../../types";

// Service Worker → Content Script: show a pet animation on the page.
export type ShowNotificationMessage = {
  type: "SHOW_NOTIFICATION";
  payload: NotificationPayload;
};

export type PetMoodMessage = ShowNotificationMessage;
