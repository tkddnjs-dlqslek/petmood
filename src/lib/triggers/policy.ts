import type { DisplayType, PetMoodSettings } from "../../types";

export const FREQUENCY_PRESETS: Record<
  Exclude<PetMoodSettings["frequencyPreset"], "custom">,
  number
> = {
  quiet: 60,
  normal: 30,
  lively: 10,
};

const ALL_ANIMATIONS: DisplayType[] = [
  "stampede", "rain", "parade", "peekaboo", "bounce", "popcorn",
  "carousel", "float", "tornado", "photoBooth", "teleport", "dominoFall",
  "trampoline", "bowling", "fireworks", "kiss", "rainbowArc", "danceParty",
];

/** Uniform random across all 18 animation types. */
export function pickAnimationType(): DisplayType {
  return ALL_ANIMATIONS[Math.floor(Math.random() * ALL_ANIMATIONS.length)];
}
