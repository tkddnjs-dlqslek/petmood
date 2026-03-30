import type { ActivityType } from "../../types";
import messagesJson from "../../../messages.json";

// Load messages from JSON file
export const MESSAGE_BANK: Record<ActivityType, string[]> = messagesJson as Record<ActivityType, string[]>;

/**
 * Pick a random message for the given activity, avoiding recent ones.
 */
export function pickMessage(
  activity: ActivityType,
  recentMessages: string[]
): string {
  const pool = MESSAGE_BANK[activity] ?? [];
  if (pool.length === 0) return "...";

  // Filter out recently used
  const available = pool.filter((m) => !recentMessages.includes(m));
  const candidates = available.length > 0 ? available : pool;

  return candidates[Math.floor(Math.random() * candidates.length)];
}
