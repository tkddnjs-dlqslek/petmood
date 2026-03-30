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

  // Score each template by specificity
  const scored = MESSAGE_BANK.filter(
    (t) => t.activity === context.activity
  ).map((t) => ({
    template: t,
    score: computeScore(t, timeCtx, context.triggerType),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out recently used
  const candidates = scored.filter(
    (s) => !context.recentMessageIds.includes(s.template.id)
  );

  // Pick from top candidates (or fall back to all if all were recent)
  const pool = candidates.length > 0 ? candidates : scored;
  if (pool.length === 0) {
    // Fallback message
    return {
      id: "fallback",
      text: `${context.petName}이가 ${context.userName}을 응원해!`,
    };
  }

  // Pick randomly from top 3 (or fewer)
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
  // Exact time match
  if (t.timeContext === timeCtx) score += 2;
  else if (t.timeContext === "any") score += 1;
  else score -= 1; // Wrong time context

  // Exact trigger match
  if (t.triggerContext === triggerType) score += 2;
  else if (t.triggerContext === "any") score += 1;

  return score;
}

/**
 * Pick an activity that matches the current context
 */
export function suggestActivity(
  timeCtx: TimeContext,
  triggerType: TriggerType
): ActivityType {
  const contextMap: Record<string, ActivityType[]> = {
    "night:browse-duration": ["sleeping", "yawning"],
    "night:timer": ["sleeping", "lying"],
    "night:time-of-day": ["sleeping", "yawning"],
    "morning:timer": ["stretching", "running", "standing"],
    "morning:time-of-day": ["stretching", "eating"],
    "morning:browse-duration": ["stretching", "head-tilting"],
    "afternoon:time-of-day": ["eating", "yawning"],
    "afternoon:timer": ["playing", "sitting", "running"],
    "afternoon:browse-duration": ["head-tilting", "stretching"],
    "evening:time-of-day": ["eating", "yawning"],
    "evening:timer": ["lying", "sitting", "playing"],
    "evening:browse-duration": ["sleeping", "lying", "head-tilting"],
  };

  const key = `${timeCtx}:${triggerType}`;
  const candidates = contextMap[key] ?? [
    "sitting",
    "playing",
    "head-tilting",
  ];
  return candidates[Math.floor(Math.random() * candidates.length)];
}
