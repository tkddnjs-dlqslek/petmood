import type { ActivityType, TimeContext, TriggerType } from "../../types";
import { MESSAGE_BANK, type MessageTemplate } from "./message-bank";

export function getTimeContext(hour: number): TimeContext {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function selectMessage(context: {
  activity: ActivityType;
  triggerType: TriggerType;
  currentHour: number;
  userName: string;
  petName: string;
  recentMessageIds: string[];
}): { id: string; text: string } {
  const timeCtx = getTimeContext(context.currentHour);

  const scored = MESSAGE_BANK.filter(
    (t) => t.activity === context.activity
  ).map((t) => ({
    template: t,
    score: computeScore(t, timeCtx, context.triggerType),
  }));

  scored.sort((a, b) => b.score - a.score);

  const candidates = scored.filter(
    (s) => !context.recentMessageIds.includes(s.template.id)
  );

  const pool = candidates.length > 0 ? candidates : scored;
  if (pool.length === 0) {
    return {
      id: "fallback",
      text: `${context.petName}이가 ${context.userName}을 응원해!`,
    };
  }

  const topN = pool.slice(0, Math.min(3, pool.length));
  const picked = topN[Math.floor(Math.random() * topN.length)];

  const text = picked.template.template
    .replace(/\{\{name\}\}/g, context.userName)
    .replace(/\{\{petName\}\}/g, context.petName);

  return { id: picked.template.id, text };
}

function computeScore(
  t: MessageTemplate,
  timeCtx: TimeContext,
  triggerType: TriggerType
): number {
  let score = 0;
  if (t.timeContext === timeCtx) score += 2;
  else if (t.timeContext === "any") score += 1;
  else score -= 1;

  if (t.triggerContext === triggerType) score += 2;
  else if (t.triggerContext === "any") score += 1;

  return score;
}

/**
 * Pick an activity that matches the current context (6 classes)
 */
export function suggestActivity(
  timeCtx: TimeContext,
  triggerType: TriggerType
): ActivityType {
  const contextMap: Record<string, ActivityType[]> = {
    // night
    "night:browse-duration": ["resting", "yawning"],
    "night:timer": ["resting", "relaxing"],
    "night:time-of-day": ["resting", "yawning"],
    // morning
    "morning:timer": ["yawning", "active", "alert"],
    "morning:time-of-day": ["yawning", "eating"],
    "morning:browse-duration": ["yawning", "alert"],
    // afternoon
    "afternoon:time-of-day": ["eating", "yawning"],
    "afternoon:timer": ["active", "alert", "relaxing"],
    "afternoon:browse-duration": ["alert", "yawning"],
    // evening
    "evening:time-of-day": ["eating", "relaxing"],
    "evening:timer": ["relaxing", "alert", "resting"],
    "evening:browse-duration": ["resting", "relaxing", "yawning"],
  };

  const key = `${timeCtx}:${triggerType}`;
  const candidates = contextMap[key] ?? ["alert", "relaxing"];
  return candidates[Math.floor(Math.random() * candidates.length)];
}
