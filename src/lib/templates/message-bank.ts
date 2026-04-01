import type { ActivityType } from "../../types";
import defaultMessages from "../../../messages.json";

// Default messages from JSON
export const DEFAULT_MESSAGES: Record<string, string[]> = defaultMessages;

// Alias for backward compat
export const MESSAGE_BANK = DEFAULT_MESSAGES;

/**
 * Get messages for a category, merging custom messages based on mode.
 */
export function getMessages(
  activity: string,
  customMessages: Record<string, string[]>,
  mode: "mix" | "custom-only"
): string[] {
  const custom = customMessages[activity] ?? [];
  const defaults = DEFAULT_MESSAGES[activity] ?? [];

  if (mode === "custom-only" && custom.length > 0) {
    return custom;
  }
  // Mix mode: custom first, then defaults
  return [...custom, ...defaults];
}

/**
 * Pick a random message, avoiding recent ones.
 */
export function pickMessage(
  activity: string,
  recentMessages: string[],
  customMessages: Record<string, string[]> = {},
  mode: "mix" | "custom-only" = "mix"
): string {
  const pool = getMessages(activity, customMessages, mode);
  if (pool.length === 0) return "...";

  const available = pool.filter((m) => !recentMessages.includes(m));
  const candidates = available.length > 0 ? available : pool;

  return candidates[Math.floor(Math.random() * candidates.length)];
}
