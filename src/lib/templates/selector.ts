import type { ActivityType, TimeContext, TriggerType } from "../../types";
import { pickMessage } from "./message-bank";

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
  const text = pickMessage(context.activity, context.recentMessageIds);
  return { id: text, text };
}

export function suggestActivity(
  timeCtx: TimeContext,
  triggerType: TriggerType
): ActivityType {
  const contextMap: Record<string, ActivityType[]> = {
    "night:browse-duration": ["sleeping", "angry"],
    "night:timer": ["sleeping", "sad"],
    "night:time-of-day": ["sleeping"],
    "morning:timer": ["happy", "running"],
    "morning:time-of-day": ["eating", "happy"],
    "morning:browse-duration": ["happy", "running"],
    "afternoon:time-of-day": ["eating"],
    "afternoon:timer": ["running", "happy"],
    "afternoon:browse-duration": ["angry", "sad"],
    "evening:time-of-day": ["eating", "sleeping"],
    "evening:timer": ["happy", "sad"],
    "evening:browse-duration": ["sleeping", "sad", "angry"],
  };

  const key = `${timeCtx}:${triggerType}`;
  const candidates = contextMap[key] ?? ["happy", "sad"];
  return candidates[Math.floor(Math.random() * candidates.length)];
}
